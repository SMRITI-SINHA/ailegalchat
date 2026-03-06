import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, Environment } from '@react-three/drei'
import * as THREE from 'three'

export const BOT_STATE = {
  IDLE:       'idle',
  LISTENING:  'listening',
  THINKING:   'thinking',
  SPEAKING:   'speaking',
  SUCCESS:    'success',
  ALERT:      'alert',
  ERROR:      'error',
  GREETING:   'greeting',
  DECISION:   'decision',
}

const STATE_ANIMATION = {
  [BOT_STATE.IDLE]:      'Hover_Float',
  [BOT_STATE.LISTENING]: 'Head_Listen',
  [BOT_STATE.THINKING]:  'Thinking_Pose',
  [BOT_STATE.SPEAKING]:  'Speaking_Loop',
  [BOT_STATE.SUCCESS]:   'Excited_Bounce',
  [BOT_STATE.ALERT]:     'Alert',
  [BOT_STATE.ERROR]:     'Confused_Shrug',
  [BOT_STATE.GREETING]:  'Wave_Hello',
  [BOT_STATE.DECISION]:  'Point_Forward',
}

const STATE_FACE = {
  [BOT_STATE.IDLE]:      '/robot_avatar/face_happy.png',
  [BOT_STATE.LISTENING]: '/robot_avatar/face_happy.png',
  [BOT_STATE.THINKING]:  '/robot_avatar/face_thinking.png',
  [BOT_STATE.SPEAKING]:  '/robot_avatar/face_talking.png',
  [BOT_STATE.SUCCESS]:   '/robot_avatar/face_excited.png',
  [BOT_STATE.ALERT]:     '/robot_avatar/face_surprised.png',
  [BOT_STATE.ERROR]:     '/robot_avatar/face_surprised.png',
  [BOT_STATE.GREETING]:  '/robot_avatar/face_happy.png',
  [BOT_STATE.DECISION]:  '/robot_avatar/face_serious.png',
}

const IDLE_BEHAVIORS = [
  { type: 'lookAround', duration: 2.5 },
  { type: 'tiltHead', duration: 2.0 },
  { type: 'nod', duration: 1.5 },
  { type: 'bounce', duration: 2.0 },
]

const lerp = (a, b, t) => a + (b - a) * t

function RobotModel({ botState, audioAmplitude = 0, mousePos }) {
  const group = useRef()
  const { scene, animations } = useGLTF('/robot_avatar/LexAI_Robot_Final.glb')
  const { actions, mixer } = useAnimations(animations, group)

  const currentActionRef = useRef(null)
  const faceTextureRef = useRef(null)
  const faceMeshRef = useRef(null)
  const speechBubbleRef = useRef(null)
  const gavelRef = useRef(null)
  const auraRef = useRef(null)
  const auraActionRef = useRef(null)
  const gavelActionRef = useRef(null)
  const prevStateRef = useRef(null)

  const headBoneRef = useRef(null)
  const headfrontBoneRef = useRef(null)
  const headBaseRotRef = useRef({ x: 0, y: 0, z: 0 })
  const smoothMouseRef = useRef({ x: 0, y: 0 })
  const breathPhaseRef = useRef(0)
  const idleBehaviorRef = useRef({ active: false, type: null, startTime: 0, duration: 0 })
  const nextIdleTimeRef = useRef(3)

  useEffect(() => {
    if (!scene) return
    scene.traverse((obj) => {
      if (obj.name === 'SpeechBubble') speechBubbleRef.current = obj
      if (obj.name === 'Gavel') gavelRef.current = obj
      if (obj.name === 'ParticleAura') auraRef.current = obj

      if (obj.isMesh && (obj.name.toLowerCase().includes('face') || obj.name.toLowerCase().includes('screen'))) {
        faceMeshRef.current = obj
      }

      if (obj.isBone && obj.name === 'Head') {
        headBoneRef.current = obj
        headBaseRotRef.current = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z }
      }
      if (obj.isBone && obj.name === 'headfront') {
        headfrontBoneRef.current = obj
      }
    })

    if (speechBubbleRef.current) speechBubbleRef.current.visible = false
    if (gavelRef.current) gavelRef.current.visible = false
    if (auraRef.current) auraRef.current.visible = false

    playAnimation('Wave_Hello', false)
    setTimeout(() => playAnimation('Hover_Float', true), 2200)

    if (actions['ParticleAura_Spin']) auraActionRef.current = actions['ParticleAura_Spin']
    if (actions['Gavel_Swing']) gavelActionRef.current = actions['Gavel_Swing']
  }, [scene, actions])

  const playAnimation = useCallback((name, loop = true) => {
    const action = actions[name]
    if (!action) return

    if (currentActionRef.current && currentActionRef.current !== action) {
      currentActionRef.current.fadeOut(0.35)
    }

    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = !loop
    action.fadeIn(0.35).play()
    currentActionRef.current = action
  }, [actions])

  const updateFace = useCallback((texturePath) => {
    if (!faceMeshRef.current) return
    const loader = new THREE.TextureLoader()
    loader.load(texturePath, (tex) => {
      tex.encoding = THREE.sRGBEncoding
      tex.flipY = false

      if (faceMeshRef.current.material) {
        if (!faceTextureRef.current) {
          faceMeshRef.current.material = faceMeshRef.current.material.clone()
        }

        faceMeshRef.current.material.map = tex
        faceMeshRef.current.material.emissiveMap = tex
        faceMeshRef.current.material.emissive = new THREE.Color(0xd4af37)
        faceMeshRef.current.material.emissiveIntensity = 3.5
        faceMeshRef.current.material.transparent = true
        faceMeshRef.current.material.needsUpdate = true
        faceTextureRef.current = tex
      }
    })
  }, [])

  useEffect(() => {
    if (!actions || botState === prevStateRef.current) return
    prevStateRef.current = botState

    const animName = STATE_ANIMATION[botState]
    const isLoop = [BOT_STATE.IDLE, BOT_STATE.SPEAKING, BOT_STATE.LISTENING].includes(botState)
    if (animName) playAnimation(animName, isLoop)

    const faceTex = STATE_FACE[botState]
    if (faceTex) updateFace(faceTex)

    if (botState !== BOT_STATE.IDLE) {
      idleBehaviorRef.current.active = false
    }

    if (speechBubbleRef.current) {
      speechBubbleRef.current.visible = botState === BOT_STATE.SPEAKING
    }

    if (gavelRef.current) {
      const showGavel = botState === BOT_STATE.DECISION
      gavelRef.current.visible = showGavel
      if (showGavel && gavelActionRef.current) {
        gavelActionRef.current.reset().play()
      }
    }

    if (auraRef.current) {
      const showAura = botState === BOT_STATE.SUCCESS
      auraRef.current.visible = showAura
      if (showAura && auraActionRef.current) {
        auraActionRef.current.reset()
          .setLoop(THREE.LoopRepeat, Infinity)
          .play()
      } else if (!showAura && auraActionRef.current) {
        auraActionRef.current.stop()
      }
    }
  }, [botState, actions, playAnimation, updateFace])

  useFrame((state, delta) => {
    if (!group.current) return
    const t = state.clock.elapsedTime

    const mx = mousePos?.x ?? state.mouse.x
    const my = mousePos?.y ?? state.mouse.y
    smoothMouseRef.current.x = lerp(smoothMouseRef.current.x, mx * 0.35, 0.08)
    smoothMouseRef.current.y = lerp(smoothMouseRef.current.y, my * 0.2, 0.08)

    breathPhaseRef.current += delta * 1.2
    const breathScale = 1.0 + Math.sin(breathPhaseRef.current) * 0.003
    group.current.scale.set(breathScale, breathScale, breathScale)

    let headExtraX = 0
    let headExtraY = 0
    let headExtraZ = 0
    let posY = 0

    headExtraY = smoothMouseRef.current.x
    headExtraX = smoothMouseRef.current.y

    if (botState === BOT_STATE.SPEAKING && audioAmplitude > 0) {
      headExtraX += Math.sin(t * 12) * audioAmplitude * 0.06
      posY = Math.sin(t * 2.5) * audioAmplitude * 0.015

      if (faceMeshRef.current?.material) {
        faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 20) * audioAmplitude * 2.0
      }
    } else if (botState === BOT_STATE.LISTENING) {
      posY = Math.sin(t * 2) * 0.01 + audioAmplitude * 0.015
      headExtraX += Math.sin(t * 1.5) * 0.025

    } else if (botState === BOT_STATE.THINKING) {
      posY = Math.sin(t * 0.6) * 0.008
      headExtraZ = Math.sin(t * 0.5) * 0.03
      headExtraX += -0.03 + Math.sin(t * 0.3) * 0.015

    } else if (botState === BOT_STATE.IDLE) {
      posY = Math.sin(t * 0.8) * 0.01

      const idle = idleBehaviorRef.current
      if (!idle.active && t > nextIdleTimeRef.current) {
        const behavior = IDLE_BEHAVIORS[Math.floor(Math.random() * IDLE_BEHAVIORS.length)]
        idle.active = true
        idle.type = behavior.type
        idle.startTime = t
        idle.duration = behavior.duration
      }

      if (idle.active) {
        const progress = (t - idle.startTime) / idle.duration
        if (progress >= 1) {
          idle.active = false
          nextIdleTimeRef.current = t + 2 + Math.random() * 4
        } else {
          const ease = Math.sin(progress * Math.PI)
          switch (idle.type) {
            case 'lookAround':
              headExtraY += Math.sin(progress * Math.PI * 2) * 0.08 * ease
              break
            case 'tiltHead':
              headExtraZ += Math.sin(progress * Math.PI) * 0.04
              break
            case 'nod':
              headExtraX += Math.sin(progress * Math.PI * 3) * 0.03 * ease
              break
            case 'bounce':
              posY += Math.sin(progress * Math.PI * 4) * 0.02 * ease
              break
          }
        }
      }

      if (faceMeshRef.current?.material) {
        faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 2) * 0.5
      }
    }

    group.current.position.y = posY

    if (headBoneRef.current) {
      headBoneRef.current.rotation.x = headBaseRotRef.current.x + headExtraX
      headBoneRef.current.rotation.y = headBaseRotRef.current.y + headExtraY
      headBoneRef.current.rotation.z = headBaseRotRef.current.z + headExtraZ
    }

    const blinkCycle = Math.sin(t * 0.7) * Math.sin(t * 1.3)
    const isBlinking = blinkCycle > 0.97 && botState !== BOT_STATE.SPEAKING
    if (headfrontBoneRef.current) {
      const targetY = isBlinking ? 0.1 : 1.0
      headfrontBoneRef.current.scale.y = lerp(headfrontBoneRef.current.scale.y, targetY, isBlinking ? 0.4 : 0.2)
    }

    if (speechBubbleRef.current && speechBubbleRef.current.visible) {
      speechBubbleRef.current.position.y = 0.6 + Math.sin(t * 2) * 0.03
      speechBubbleRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05)
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

function MouseTracker({ onMouseMove }) {
  const { gl } = useThree()

  useEffect(() => {
    const handleMove = (e) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      onMouseMove({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })
    }

    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [gl, onMouseMove])

  return null
}

export default function LexAIRobot({
  botState = BOT_STATE.IDLE,
  audioAmplitude = 0,
  className = '',
  onWebGLFail,
  onLoaded
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const mouseCb = useCallback((pos) => setMousePos(pos), [])
  const [webglOk, setWebglOk] = useState(null)

  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      const ok = !!(c.getContext('webgl2') || c.getContext('webgl'))
      setWebglOk(ok)
      if (!ok && onWebGLFail) onWebGLFail()
    } catch {
      setWebglOk(false)
      if (onWebGLFail) onWebGLFail()
    }
  }, [])

  if (webglOk === null) return null
  if (!webglOk) return null

  return (
    <div className={`lexai-robot-container ${className}`} style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas
        camera={{ position: [0, 0.9, 3.0], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.2
          if (onLoaded) onLoaded()
        }}
      >
        <ambientLight intensity={0.8} color="#ffffff" />
        <spotLight position={[5, 10, 5]} angle={0.15} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-5, -5, -5]} intensity={1} color="#b69d74" />

        <MouseTracker onMouseMove={mouseCb} />
        <RobotModel botState={botState} audioAmplitude={audioAmplitude} mousePos={mousePos} />

        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/robot_avatar/LexAI_Robot_Final.glb')
