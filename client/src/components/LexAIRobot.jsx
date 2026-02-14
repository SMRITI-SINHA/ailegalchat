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
  { type: 'swirl', duration: 3.0 },
  { type: 'nod', duration: 1.5 },
  { type: 'bounce', duration: 2.0 },
]

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function RobotModel({ botState, audioAmplitude = 0, mousePos, isHovering }) {
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
  
  const idleBehaviorRef = useRef({ active: false, type: null, startTime: 0, duration: 0 })
  const nextIdleTimeRef = useRef(3)
  const smoothMouseRef = useRef({ x: 0, y: 0 })
  const baseGroupRotY = useRef(0)
  const baseGroupPosY = useRef(0)

  useEffect(() => {
    if (!scene) return
    scene.traverse((obj) => {
      if (obj.name === 'SpeechBubble') speechBubbleRef.current = obj
      if (obj.name === 'Gavel') gavelRef.current = obj
      if (obj.name === 'ParticleAura') auraRef.current = obj
      
      if (obj.isMesh && (obj.name.toLowerCase().includes('face') || obj.name.toLowerCase().includes('screen'))) {
        faceMeshRef.current = obj
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

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime

    const mx = clamp(mousePos?.x ?? 0, -1, 1)
    const my = clamp(mousePos?.y ?? 0, -1, 1)
    const mouseInfluence = isHovering ? 1.0 : 0.0
    const targetX = mx * 0.25 * mouseInfluence
    const targetY = my * 0.12 * mouseInfluence
    smoothMouseRef.current.x += (targetX - smoothMouseRef.current.x) * 0.05
    smoothMouseRef.current.y += (targetY - smoothMouseRef.current.y) * 0.05

    const bodyRotTarget = smoothMouseRef.current.x * 0.25
    baseGroupRotY.current += (bodyRotTarget - baseGroupRotY.current) * 0.03
    group.current.rotation.y = baseGroupRotY.current

    if (botState === BOT_STATE.IDLE) {
      const idle = idleBehaviorRef.current
      
      if (!idle.active && t > nextIdleTimeRef.current) {
        const behavior = IDLE_BEHAVIORS[Math.floor(Math.random() * IDLE_BEHAVIORS.length)]
        idle.active = true
        idle.type = behavior.type
        idle.startTime = t
        idle.duration = behavior.duration
      }

      if (idle.active) {
        const elapsed = t - idle.startTime
        const progress = elapsed / idle.duration
        
        if (progress >= 1) {
          idle.active = false
          baseGroupPosY.current = 0
          nextIdleTimeRef.current = t + 2 + Math.random() * 4
        } else {
          const ease = Math.sin(progress * Math.PI)
          
          switch (idle.type) {
            case 'lookAround': {
              const lookOffset = Math.sin(progress * Math.PI * 2) * 0.15 * ease
              baseGroupRotY.current += lookOffset * 0.3
              break
            }
            case 'tiltHead': {
              group.current.rotation.z = Math.sin(progress * Math.PI) * 0.06
              break
            }
            case 'swirl': {
              baseGroupRotY.current += Math.sin(progress * Math.PI * 2) * 0.015
              baseGroupPosY.current = Math.sin(progress * Math.PI * 3) * 0.04
              break
            }
            case 'nod': {
              group.current.rotation.x = Math.sin(progress * Math.PI * 3) * 0.04 * ease
              break
            }
            case 'bounce': {
              baseGroupPosY.current = Math.sin(progress * Math.PI * 4) * 0.03 * ease
              break
            }
          }
          group.current.position.y = baseGroupPosY.current
        }
      }

      group.current.position.y += Math.sin(t * 0.8) * 0.003
    }

    if (botState === BOT_STATE.SPEAKING && audioAmplitude > 0) {
      if (faceMeshRef.current?.material) {
        faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 20) * audioAmplitude * 2.0
      }
    } else if (faceMeshRef.current?.material) {
      faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 2) * 0.5
    }

    const blinkCycle = Math.sin(t * 0.7) * Math.sin(t * 1.3)
    if (blinkCycle > 0.98) {
      scene.traverse((obj) => {
        if (obj.name === 'headfront') {
          obj.scale.y = 0.1
        }
      })
    } else {
      scene.traverse((obj) => {
        if (obj.name === 'headfront') {
          obj.scale.y += (1.0 - obj.scale.y) * 0.3
        }
      })
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

function MouseTracker({ onMouseMove, onHoverChange }) {
  const { gl } = useThree()
  
  useEffect(() => {
    const canvas = gl.domElement
    const parentEl = canvas.parentElement
    
    const handleMove = (e) => {
      const rect = parentEl.getBoundingClientRect()
      const x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
      const y = clamp(-((e.clientY - rect.top) / rect.height) * 2 + 1, -1, 1)
      onMouseMove({ x, y })
    }
    
    const handleEnter = () => onHoverChange(true)
    const handleLeave = () => onHoverChange(false)
    
    parentEl.addEventListener('mousemove', handleMove)
    parentEl.addEventListener('mouseenter', handleEnter)
    parentEl.addEventListener('mouseleave', handleLeave)
    
    return () => {
      parentEl.removeEventListener('mousemove', handleMove)
      parentEl.removeEventListener('mouseenter', handleEnter)
      parentEl.removeEventListener('mouseleave', handleLeave)
    }
  }, [gl, onMouseMove, onHoverChange])
  
  return null
}

export default function LexAIRobot({ 
  botState = BOT_STATE.IDLE,
  audioAmplitude = 0,
  className = ''
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const mouseCb = useCallback((pos) => setMousePos(pos), [])
  const hoverCb = useCallback((v) => setIsHovering(v), [])

  return (
    <div className={`lexai-robot-container ${className}`} style={{ width: '100%', height: '100%', minHeight: '320px' }}>
      <Canvas
        camera={{ position: [0, 0.6, 2.0], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.2
        }}
      >
        <ambientLight intensity={0.8} color="#ffffff" />
        <spotLight position={[5, 10, 5]} angle={0.15} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-5, -5, -5]} intensity={1} color="#b69d74" />
        
        <MouseTracker onMouseMove={mouseCb} onHoverChange={hoverCb} />
        <RobotModel botState={botState} audioAmplitude={audioAmplitude} mousePos={mousePos} isHovering={isHovering} />
        
        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/robot_avatar/LexAI_Robot_Final.glb')
