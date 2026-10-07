import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Eye, LoaderCircle, Monitor, Play, RefreshCw, RotateCcw, Save, Smartphone, Sparkles } from 'lucide-react'
import type { WarmupQuestion } from '../services/quizData'
import { prepareCoursewareViews } from '../services/coursewareExport'
import type { CoursewareManifest, CoursewareScene, CoursewareLayout, CoursewareMotion } from '../types/courseware'
import { localizeCourseware, sceneLabels } from '../services/coursewareChinese'

type Props = {
  lessonPlan: Record<string, unknown>
  model: Record<string, unknown> | null
  questions: WarmupQuestion[]
  manifest: CoursewareManifest | null
  onChange: (manifest: CoursewareManifest) => void
  onNotice: (message: string) => void
}

const layouts: Array<[CoursewareLayout, string]> = [
  ['cinematic-question', '问题导入'], ['outcome-rail', '成果轨道'], ['model-stage', '模型舞台'],
  ['anatomy-focus', '解剖聚焦'], ['flow-path', '血流路径'], ['compare-split', '对照分析'],
  ['evidence-board', '证据板'], ['quiz-stage', '答题舞台'], ['closing-loop', '闭环总结'],
]
const motions: Array<[CoursewareMotion, string]> = [
  ['fade', '淡入'], ['rise', '上升'], ['focus', '聚焦'], ['flow', '路径流动'],
  ['explode', '部件爆炸'], ['reveal', '分步揭示'],
]

function download(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove()
}

function ScenePreview({ scene, manifest, mobile }: { scene: CoursewareScene; manifest: CoursewareManifest; mobile: boolean }) {
  scene = localizeCourseware(scene)
  const hasModel = Boolean(scene.model)
  const detail = scene.detail || {}
  const detailList = (items?: string[]) => items?.filter(Boolean).join('；') || '未补充'
  return <div className={`courseware-live-preview ${mobile ? 'is-mobile' : ''} layout-${scene.layout}`}>
    <div className="courseware-scene-number">{scene.id.replace('scene-', '')} / {manifest.scenes.filter((item) => item.enabled).length}</div>
    <div className="courseware-scene-copy">
      <span className="section-kicker">互动课件 · {sceneLabels[scene.type]}</span>
      <h2>{scene.title}</h2>
      <p>{scene.claim}</p>
      <div className="courseware-task"><strong>学生操作</strong><span>{scene.studentAction}</span></div>
    </div>
    <div className="courseware-detail-grid">
      <div><small>学习内容</small><span>{detail.learningContent || scene.claim}</span></div>
      <div><small>教师过程</small><span>{detailList(detail.teacherScript)}</span></div>
      <div><small>学生步骤</small><span>{detailList(detail.studentSteps)}</span></div>
      <div><small>教师追问</small><span>{detailList(detail.questioning)}</span></div>
      <div><small>评价标准</small><span>{detailList(detail.evaluationRubric)}</span></div>
      <div><small>未达标补救</small><span>{detail.remediation || '根据评价结果补充示范和练习。'}</span></div>
    </div>
    {hasModel && <div className="courseware-model-preview">
      <model-viewer src={manifest.model.modelUrl} camera-controls auto-rotate={scene.motion.preset === 'flow' || undefined} shadow-intensity="1" exposure="1" environment-image="neutral" />
      <div className="courseware-part-strip">{scene.model?.partKeys.slice(0, 4).map((key) => <span key={key}>{manifest.model.parts.find((part) => part.partKey === key)?.partLabel || key}</span>)}</div>
    </div>}
    {scene.type === 'blood-flow' && <div className="courseware-flow-preview"><span className="venous">腔静脉</span><i>→</i><span className="venous">右心</span><i>→</i><span>肺</span><i>→</i><span className="arterial">左心</span><i>→</i><span className="arterial">主动脉</span></div>}
    {!hasModel && scene.type !== 'blood-flow' && <div className="courseware-output"><small>预期产出</small><strong>{scene.expectedOutput}</strong></div>}
  </div>
}

export default function CoursewareStoryboard({ lessonPlan, model, questions, manifest, onChange, onNotice }: Props) {
  const [selectedId, setSelectedId] = useState('scene-01')
  const [mobile, setMobile] = useState(false)
  const [busy, setBusy] = useState<'generate' | 'save' | 'scene' | 'zip' | 'pptx' | null>(null)
  const baseline = useRef<CoursewareManifest | null>(null)
  const selected = manifest?.scenes.find((scene) => scene.id === selectedId) || manifest?.scenes[0]
  const enabledCount = manifest?.scenes.filter((scene) => scene.enabled).length || 0
  const quality = manifest?.quality

  useEffect(() => {
    if (manifest && !manifest.scenes.some((scene) => scene.id === selectedId)) setSelectedId(manifest.scenes[0]?.id || 'scene-01')
  }, [manifest, selectedId])

  const generate = async () => {
    setBusy('generate')
    try {
      const response = await fetch('/api/prep/courseware/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan, model, questions }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '互动课件生成失败')
      baseline.current = structuredClone(data.manifest)
      onChange(localizeCourseware(data.manifest)); setSelectedId(data.manifest.scenes[0]?.id || 'scene-01'); onNotice(`已生成 ${data.manifest.scenes.length} 个场景，可逐场景编辑`)
    } catch (error) { onNotice(error instanceof Error ? error.message : '互动课件生成失败') }
    finally { setBusy(null) }
  }

  const updateScene = (patch: Partial<CoursewareScene>) => {
    if (!manifest || !selected) return
    const scenes = manifest.scenes.map((scene) => scene.id === selected.id ? { ...scene, ...patch, source: 'teacher-edited' as const } : scene)
    onChange({ ...manifest, scenes, revision: manifest.revision + 1, status: 'draft' })
  }

  const move = (offset: number) => {
    if (!manifest || !selected) return
    const index = manifest.scenes.findIndex((scene) => scene.id === selected.id)
    const next = index + offset
    if (next < 0 || next >= manifest.scenes.length) return
    const scenes = [...manifest.scenes]; [scenes[index], scenes[next]] = [scenes[next], scenes[index]]
    onChange({ ...manifest, scenes, revision: manifest.revision + 1, status: 'draft' })
  }

  const save = async () => {
    if (!manifest) return
    setBusy('save')
    try {
      const response = await fetch(`/api/courseware/${encodeURIComponent(manifest.lessonId)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.message || '课件保存失败')
      onNotice(`互动课件已保存 · 修订 ${data.revision}`)
    } catch (error) { onNotice(error instanceof Error ? error.message : '课件保存失败') }
    finally { setBusy(null) }
  }

  const regenerate = async () => {
    if (!manifest || !selected) return
    setBusy('scene')
    try {
      const response = await fetch('/api/prep/courseware/regenerate-scene', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest, sceneId: selected.id }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '场景重做失败')
      onChange(data.manifest); onNotice(`已重新生成“${selected.title}”`)
    } catch (error) { onNotice(error instanceof Error ? error.message : '场景重做失败') }
    finally { setBusy(null) }
  }

  const exportArtifact = async (type: 'zip' | 'pptx') => {
    if (!manifest) return
    setBusy(type)
    try {
      const prepared = type === 'pptx' ? await prepareCoursewareViews(manifest, onNotice) : manifest
      if (type === 'pptx') onChange(prepared)
      const response = await fetch(`/api/prep/courseware/export-${type}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest: prepared }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '导出失败')
      download(data.downloadUrl, data.fileName)
      onNotice(type === 'zip' ? '离线课件 ZIP 已生成' : `配套 PPTX 已生成 · ${data.export?.message || '浏览器已开始下载'}`)
    } catch (error) { onNotice(error instanceof Error ? error.message : '导出失败') }
    finally { setBusy(null) }
  }

  const restore = () => {
    if (!baseline.current) return onNotice('当前还没有可恢复的系统版本')
    onChange(structuredClone(baseline.current)); onNotice('已恢复本次生成的系统版本')
  }

  const editForm = useMemo(() => selected ? <div className="courseware-scene-editor">
    <div className="section-title"><span>场景内容</span><small>{selected.source === 'teacher-edited' ? '教师已编辑' : '系统生成'}</small></div>
    <label className="inline-edit"><span>标题</span><input value={selected.title} onChange={(event) => updateScene({ title: event.target.value })} /></label>
    <label className="inline-edit"><span>核心结论</span><textarea rows={2} value={selected.claim} onChange={(event) => updateScene({ claim: event.target.value })} /></label>
    <label className="inline-edit"><span>教师提示</span><textarea rows={2} value={selected.teacherCue} onChange={(event) => updateScene({ teacherCue: event.target.value })} /></label>
    <label className="inline-edit"><span>学生操作</span><textarea rows={2} value={selected.studentAction} onChange={(event) => updateScene({ studentAction: event.target.value })} /></label>
    <label className="inline-edit"><span>预期产出</span><input value={selected.expectedOutput} onChange={(event) => updateScene({ expectedOutput: event.target.value })} /></label>
    <label className="inline-edit"><span>学习内容</span><textarea rows={3} value={selected.detail?.learningContent || ''} onChange={(event) => updateScene({ detail: { ...selected.detail, learningContent: event.target.value } })} /></label>
    <label className="inline-edit"><span>教师过程</span><textarea rows={3} value={(selected.detail?.teacherScript || []).join('；')} onChange={(event) => updateScene({ detail: { ...selected.detail, teacherScript: event.target.value.split(/；|\n/).filter(Boolean) } })} /></label>
    <label className="inline-edit"><span>学生步骤</span><textarea rows={3} value={(selected.detail?.studentSteps || []).join('；')} onChange={(event) => updateScene({ detail: { ...selected.detail, studentSteps: event.target.value.split(/；|\n/).filter(Boolean) } })} /></label>
    <label className="inline-edit"><span>教师追问</span><textarea rows={3} value={(selected.detail?.questioning || []).join('；')} onChange={(event) => updateScene({ detail: { ...selected.detail, questioning: event.target.value.split(/；|\n/).filter(Boolean) } })} /></label>
    <label className="inline-edit"><span>评价标准</span><textarea rows={3} value={(selected.detail?.evaluationRubric || []).join('；')} onChange={(event) => updateScene({ detail: { ...selected.detail, evaluationRubric: event.target.value.split(/；|\n/).filter(Boolean) } })} /></label>
    <label className="inline-edit"><span>未达标补救</span><textarea rows={2} value={selected.detail?.remediation || ''} onChange={(event) => updateScene({ detail: { ...selected.detail, remediation: event.target.value } })} /></label>
    <div className="courseware-settings-row">
      <label className="field"><span>布局</span><select value={selected.layout} onChange={(event) => updateScene({ layout: event.target.value as CoursewareLayout })}>{layouts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="field"><span>动效</span><select value={selected.motion.preset} onChange={(event) => updateScene({ motion: { ...selected.motion, preset: event.target.value as CoursewareMotion } })}>{motions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="field"><span>时长 ms</span><input type="number" min="0" max="3000" step="50" value={selected.motion.durationMs} onChange={(event) => updateScene({ motion: { ...selected.motion, durationMs: Number(event.target.value) } })} /></label>
    </div>
    {selected.model && <div className="courseware-model-settings"><label className="field"><span>观察模式</span><select value={selected.model.mode} onChange={(event) => updateScene({ model: { ...selected.model!, mode: event.target.value as 'appearance' | 'anatomy' | 'overlay' | 'cutaway' } })}><option value="appearance">外观</option><option value="anatomy">解剖</option><option value="overlay">叠加</option><option value="cutaway">剖切</option></select></label><label className="field"><span>爆炸距离</span><input type="range" min="0" max="1" step="0.05" value={selected.model.explosionStrength} onChange={(event) => updateScene({ model: { ...selected.model!, exploded: Number(event.target.value) > 0, explosionStrength: Number(event.target.value) } })} /></label></div>}
  </div> : null, [selected, manifest])

  if (!manifest) return <section className="courseware-empty">
    <div className="courseware-empty-copy"><span className="section-kicker">互动课件</span><h3>把教案变成可操作的课堂叙事</h3><p>基于当前教案、3D 模型和练习题，按教案生成可编辑场景，并同步导出 PPTX 与离线 ZIP。</p><div><span>3D 结构观察</span><span>血流路径演示</span><span>病例证据链</span><span>手势答题</span></div></div>
    <button className="primary-btn" onClick={generate} disabled={busy !== null}>{busy === 'generate' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}生成心脏标杆互动课</button>
  </section>

  return <section className="courseware-storyboard">
    <div className="courseware-toolbar">
      <div><span className="section-kicker">课件故事板 · 第 {manifest.revision} 版</span><strong>{manifest.title}</strong><small>{enabledCount} 场景 · {quality?.layoutCount || 0} 种布局 · 质检 {quality?.score || 0}</small></div>
      <div className="courseware-toolbar-actions"><button className="icon-btn" title="桌面预览" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={16} /></button><button className="icon-btn" title="移动端预览" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={16} /></button><button className="outline-btn" onClick={restore}><RotateCcw size={15} />恢复系统版</button><button className="outline-btn" onClick={save} disabled={busy !== null}>{busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}保存</button><button className="outline-btn" onClick={() => exportArtifact('pptx')} disabled={busy !== null}><Download size={15} />配套演示文稿</button><button className="primary-btn compact" onClick={() => exportArtifact('zip')} disabled={busy !== null}><Download size={15} />离线课件</button></div>
    </div>
    <div className="courseware-editor-grid">
      <aside className="courseware-scene-rail">{manifest.scenes.map((scene, index) => <button key={scene.id} className={`${scene.id === selected?.id ? 'active' : ''} ${scene.enabled ? '' : 'disabled'}`} onClick={() => setSelectedId(scene.id)}><em>{String(index + 1).padStart(2, '0')}</em><span>{localizeCourseware(scene.title)}</span><small>{layouts.find(([key]) => key === scene.layout)?.[1] || '教学布局'}</small></button>)}</aside>
      <div className="courseware-canvas-column">{selected && <ScenePreview scene={selected} manifest={manifest} mobile={mobile} />}<div className="courseware-preview-actions"><button className="outline-btn" onClick={() => move(-1)}><ArrowUp size={14} />前移</button><button className="outline-btn" onClick={() => move(1)}><ArrowDown size={14} />后移</button><button className="outline-btn" onClick={() => updateScene({ enabled: !selected?.enabled })}><Eye size={14} />{selected?.enabled ? '停用场景' : '启用场景'}</button><button className="outline-btn" onClick={regenerate} disabled={busy !== null}>{busy === 'scene' ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}重做本场景</button><button className="outline-btn" onClick={() => onNotice('课堂运行时会按当前场景顺序播放')}><Play size={14} />课堂预览</button></div></div>
      {editForm}
    </div>
  </section>
}
