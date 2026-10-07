import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye, EyeOff, Focus, Layers3, Play, RefreshCw, RotateCcw, X } from 'lucide-react'
import type { ControlRefs } from '../types'
import type { CoursewareManifest, CoursewareScene } from '../types/courseware'
import { localizeCourseware, sceneLabels } from '../services/coursewareChinese'
import { getCoursewareContentBlocks } from '../services/coursewareSceneContent'
import type { PageDirection } from '../services/coursewareSwipe'

type Props = {
  manifest: CoursewareManifest
  controlRef: MutableRefObject<ControlRefs>
  onExit: () => void
  onStartQuiz: () => void
  quizAvailable?: boolean
  navigationRef?: MutableRefObject<((direction: PageDirection) => void) | null>
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

const MODEL_PART_ALIASES: Record<string, string[]> = {
  pulmonary_artery: ['pulmonary_arteries'],
  atrial_septum: ['interatrial_septum'],
  ventricular_septum: ['interventricular_septum'],
}

const normalizedPartKeys = (partKey: string, partLabel: string, labelEn: string) =>
  [partKey, partLabel, labelEn, ...(MODEL_PART_ALIASES[partKey] || [])]
    .map(normalize)
    .filter(Boolean)

function CameraPreset({ preset }: { preset: CoursewareScene['model'] extends { camera: infer C } ? C : string }) {
  const { camera } = useThree()
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = { front: [0, 0.2, 3.2], posterior: [0, 0.2, -3.2], left: [-3.2, 0.2, 0], right: [3.2, 0.2, 0], free: [2.4, 1.6, 2.8] }
    const position = positions[String(preset)] || positions.free
    camera.position.set(...position); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix()
  }, [camera, preset])
  return null
}

function HeartModel({ manifest, scene, hidden, isolated, selected, explosion, controlRef, onSelect }: {
  manifest: CoursewareManifest; scene: CoursewareScene; hidden: Set<string>; isolated: string | null; selected: string | null; explosion: number; controlRef: MutableRefObject<ControlRefs>; onSelect: (key: string) => void
}) {
  const gltf = useGLTF(manifest.model.modelUrl)
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const group = useRef<THREE.Group>(null)
  const mapping = useMemo(() => {
    const objects = new Map<string, THREE.Object3D>()
    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return
      const objectName = normalize(object.name)
      const part = manifest.model.parts.find((candidate) => {
        const keys = normalizedPartKeys(candidate.partKey, candidate.partLabel, candidate.labelEn)
        return keys.some((key) => key && (objectName.includes(key) || key.includes(objectName)))
      })
      if (part && !objects.has(part.partKey)) objects.set(part.partKey, object)
    })
    return objects
  }, [manifest.model.parts, root])

  useEffect(() => {
    root.traverse((object) => {
      const isAnatomy = object.name === 'Anatomy'
        || object.name.startsWith('Anatomy_')
        || object.userData.layer === 'anatomy'
        || object.userData.semantic === true
      if (isAnatomy) object.visible = false
    })
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const scale = 1.75 / Math.max(size.x, size.y, size.z, .001)
    root.position.sub(center); root.scale.setScalar(scale)
  }, [root])

  useEffect(() => {
    mapping.forEach((object, key) => {
      object.visible = !hidden.has(key) && (!isolated || isolated === key)
      const base = object.userData.coursewareBasePosition || object.position.clone()
      object.userData.coursewareBasePosition = base
      const worldCenter = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
      const direction = worldCenter.lengthSq() > .0001 ? worldCenter.normalize() : new THREE.Vector3(0, 1, 0)
      object.position.copy(base).add(direction.multiplyScalar(explosion * .65))
      object.scale.setScalar(selected === key ? 1.045 : 1)
    })
  }, [explosion, hidden, isolated, mapping, selected])

  useFrame((_, delta) => {
    if (!group.current) return
    const controls = controlRef.current
    if (controls.rotationGestureActive && !controls.rotationLocked) {
      group.current.rotation.x += controls.rotationVelocity.x * delta
      group.current.rotation.y += controls.rotationVelocity.y * delta
    }
    if (controls.zoomSpeed) {
      // Keep courseware zoom in step with ModelViewer. HandController publishes
      // a time-normalized rate; the courseware uses a further 10% reduction
      // from the previous 0.117 interaction multiplier.
      const zoomDelta = controls.zoomSpeed * 0.1053 * delta * (controls.interactionSettings?.zoomSpeed ?? 1)
      const next = THREE.MathUtils.clamp(group.current.scale.x + zoomDelta, .55, 2.1)
      group.current.scale.setScalar(next)
    }
  })

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest?.('.courseware-runtime-ui')) return
    }
    window.addEventListener('click', click)
    return () => window.removeEventListener('click', click)
  }, [])

  return <group ref={group} position={[0, -0.28, 0]}>
    <primitive object={root} />
    {Array.from(mapping.entries()).map(([key, object]) => {
      const position = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
      return scene.model?.partKeys.includes(key) ? <Html key={key} position={position} center distanceFactor={7}><button className={`courseware-part-label ${selected === key ? 'active' : ''}`} onClick={() => onSelect(key)}>{manifest.model.parts.find((part) => part.partKey === key)?.partLabel || key}</button></Html> : null
    })}
  </group>
}

function ModelStage(props: Parameters<typeof HeartModel>[0]) {
  return <Canvas camera={{ position: [2.4, 1.6, 2.8], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
    <color attach="background" args={['#071116']} />
    <ambientLight intensity={1.1} /><directionalLight position={[4, 6, 5]} intensity={3.1} color="#dffcff" /><directionalLight position={[-4, 2, -3]} intensity={2.2} color="#ff8178" />
    <CameraPreset preset={props.scene.model?.camera || 'free'} />
    <Suspense fallback={<Html center><span className="courseware-model-loading">加载本课模型…</span></Html>}><HeartModel {...props} /><ContactShadows position={[0, -1.22, 0]} opacity={.35} scale={4.4} blur={2.2} /></Suspense>
    <OrbitControls makeDefault enableDamping minDistance={1.2} maxDistance={7} />
  </Canvas>
}

const flowSteps = [
  ['上下腔静脉', 'right_atrium', 'venous'], ['右心房', 'tricuspid_valve', 'venous'], ['右心室', 'pulmonary_artery', 'venous'],
  ['肺循环', 'pulmonary_veins', 'transition'], ['左心房', 'mitral_valve', 'arterial'], ['左心室', 'aortic_valve', 'arterial'], ['主动脉', 'aorta', 'arterial'],
] as const

export default function InteractiveCourseware({ manifest, controlRef, onExit, onStartQuiz, quizAvailable = true, navigationRef }: Props) {
  const scenes = useMemo(() => localizeCourseware(manifest.scenes.filter((scene) => scene.enabled)), [manifest.scenes])
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [isolated, setIsolated] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [explosion, setExplosion] = useState(0)
  const [flowStep, setFlowStep] = useState(0)
  const hasParts = manifest.model.parts.length > 0
  const [showParts, setShowParts] = useState(() => hasParts && window.innerWidth > 800)
  const reducedMotion = useReducedMotion()
  const scene = scenes[Math.min(index, scenes.length - 1)]
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setExplosion(scene.model?.exploded ? scene.model.explosionStrength : 0)
    setHidden(new Set()); setIsolated(null); setSelected(null); setFlowStep(0)
  }, [scene.id])

  const selectPart = (key: string) => setSelected((current) => current === key ? null : key)
  const toggleHidden = (key: string) => setHidden((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next })
  const reset = () => { setHidden(new Set()); setIsolated(null); setSelected(null); setExplosion(scene.model?.exploded ? scene.model.explosionStrength : 0); setFlowStep(0) }
  const go = (delta: number) => setIndex((current) => {
    const next = Math.max(0, Math.min(scenes.length - 1, current + delta))
    if (import.meta.env.DEV) console.debug('[courseware-navigation]', { current, next, delta, reason: next === current ? 'page-boundary' : 'navigated' })
    return next
  })
  useEffect(() => {
    if (!navigationRef) return
    navigationRef.current = (direction) => go(direction === 'previous' ? -1 : 1)
    return () => { navigationRef.current = null }
  }, [navigationRef, scenes.length])
  const currentFlow = flowSteps[Math.min(flowStep, flowSteps.length - 1)]

  if (!scene) return null
  const contentBlocks = getCoursewareContentBlocks(scene)
  return <div className="courseware-runtime" ref={stageRef}>
    <div className={`courseware-runtime-stage ${scene.model ? 'has-model' : 'no-model'}`}>
      {scene.model ? <ModelStage manifest={manifest} scene={scene} hidden={hidden} isolated={isolated} selected={selected || (scene.type === 'blood-flow' ? currentFlow[1] : null)} explosion={explosion} controlRef={controlRef} onSelect={selectPart} /> : <div className={`courseware-graphic courseware-graphic-${scene.layout}`}><span>{sceneLabels[scene.type]}</span><strong>{scene.expectedOutput}</strong><div className="courseware-graphic-blocks">{contentBlocks.map((block) => <section key={block.key}><b>{block.label}</b><p>{block.value}</p></section>)}</div></div>}
      <AnimatePresence mode="wait"><motion.div key={scene.id} className="courseware-runtime-copy" initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -14 }} transition={{ duration: reducedMotion ? 0 : Math.min(600, Math.max(250, scene.motion.durationMs)) / 1000 }}>
        <span className="courseware-runtime-kicker">{String(index + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')} · {sceneLabels[scene.type]}</span>
        <h2>{scene.title}</h2><p>{scene.claim}</p>
        <div className="courseware-runtime-task"><strong>本场任务</strong><span>{scene.studentAction}</span></div>
      </motion.div></AnimatePresence>
      {scene.type === 'blood-flow' && <div className="courseware-blood-flow"><button onClick={() => setFlowStep((step) => (step + 1) % flowSteps.length)}><Play size={15} />下一段血流</button><div>{flowSteps.map(([label,, kind], step) => <span key={label} className={`${kind} ${step <= flowStep ? 'active' : ''}`}>{label}</span>)}</div></div>}
      {scene.type === 'gesture-quiz' && quizAvailable && <div className="courseware-quiz-launch"><button type="button" onClick={onStartQuiz}><ClipboardCheck size={16} />开始练习</button></div>}
    </div>

    <div className="courseware-runtime-ui">
      <header><div><span>互动课件</span><strong>{manifest.title}</strong></div><div><button title="重播场景" onClick={reset}><RefreshCw size={17} /></button><button title="退出互动课件" onClick={onExit}><X size={18} /></button></div></header>
      {hasParts && <aside className={showParts ? 'is-open' : ''}><button className="courseware-part-toggle" title="部件树" onClick={() => setShowParts((value) => !value)}><Layers3 size={17} /></button>{showParts && <div className="courseware-part-tree"><div className="courseware-part-tree-head"><strong>心脏解剖部件</strong><button onClick={reset}><RotateCcw size={14} />复位</button></div><label>爆炸距离<input type="range" min="0" max="1" step="0.05" value={explosion} onChange={(event) => setExplosion(Number(event.target.value))} /></label>{(['myocardium','chambers','septa','vessels','valves'] as const).map((group) => <section key={group}><b>{{myocardium:'心肌',chambers:'心腔',septa:'间隔',vessels:'血管',valves:'瓣膜'}[group]}</b>{manifest.model.parts.filter((part) => part.group === group).map((part) => <div key={part.partKey} className={selected === part.partKey ? 'active' : ''}><button onClick={() => selectPart(part.partKey)}>{part.partLabel}</button><button title="隐藏/显示" onClick={() => toggleHidden(part.partKey)}>{hidden.has(part.partKey) ? <EyeOff size={13} /> : <Eye size={13} />}</button><button title="隔离" onClick={() => setIsolated((value) => value === part.partKey ? null : part.partKey)}><Focus size={13} /></button></div>)}</section>)}</div>}</aside>}
      <footer><button onClick={() => go(-1)} disabled={index === 0}><ChevronLeft size={18} />上一步</button><div><span style={{ width: `${((index + 1) / scenes.length) * 100}%` }} /></div><button onClick={() => go(1)} disabled={index === scenes.length - 1}>下一步<ChevronRight size={18} /></button></footer>
    </div>
  </div>
}
