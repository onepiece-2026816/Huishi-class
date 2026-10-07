import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@google/model-viewer';
import PrepStudio from './PrepStudio';
import type { WarmupQuestion } from '../services/quizData';
import type { CoursewareManifest } from '../types/courseware';
import type { ClassroomModelAsset } from '../types/courseware';
import prepStyles from './prep-styles.css?inline';
import biomedStyles from './prep-biomed.css?inline';
import exportStyles from './lesson-export.css?inline';

export default function IntegratedPrepStudio({ onBack, onApplyLesson, userId }: { onBack: () => void; onApplyLesson: (lesson: unknown, modelUrl?: string, warmupQuestions?: WarmupQuestion[], courseware?: CoursewareManifest, modelAsset?: ClassroomModelAsset) => void | Promise<void>; userId: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    let style = root.querySelector<HTMLStyleElement>('style[data-prep-integrated]');
    if (!style) {
      style = document.createElement('style');
      style.dataset.prepIntegrated = 'true';
      root.appendChild(style);
    }
    style.textContent = `${prepStyles}\n${biomedStyles}\n${exportStyles}\n:host{display:block;height:100%;min-height:0;font-family:'Manrope','Noto Sans SC',sans-serif}.app-shell{height:100%;min-height:0}.sidebar{display:none}.main-area{min-width:0}.topbar{padding-top:18px}.integrated-back{display:inline-flex!important}`;
    setShadowRoot(root);
  }, []);

  return <div ref={hostRef} className="integrated-prep-host h-full min-h-0">{shadowRoot ? createPortal(<PrepStudio onBack={onBack} embedded onApplyLesson={onApplyLesson} userId={userId} />, shadowRoot) : null}</div>;
}
