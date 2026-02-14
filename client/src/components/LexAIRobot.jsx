import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
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

const FACE_TEXTURES = {
  happy:     '/robot_avatar/face_happy.png',
  talking:   '/robot_avatar/face_talking.png',
  thinking:  '/robot_avatar/face_thinking.png',
  excited:   '/robot_avatar/face_excited.png',
  surprised: '/robot_avatar/face_surprised.png',
  serious:   '/robot_avatar/face_serious.png',
}

const STATE_FACE = {
  [BOT_STATE.IDLE]:      'happy',
  [BOT_STATE.LISTENING]: 'happy',
  [BOT_STATE.THINKING]:  'thinking',
  [BOT_STATE.SPEAKING]:  'talking',
  [BOT_STATE.SUCCESS]:   'excited',
  [BOT_STATE.ALERT]:     'surprised',
  [BOT_STATE.ERROR]:     'surprised',
  [BOT_STATE.GREETING]:  'happy',
  [BOT_STATE.DECISION]:  'serious',
}

const SPEAKING_FACE_CYCLE = ['talking', 'happy', 'excited', 'talking']

const IDLE_BEHAVIORS = [
  { type: 'lookAround', duration: 2.5 },
  { type: 'tiltHead', duration: 2.0 },
  { type: 'swirl', duration: 3.0 },
  { type: 'nod', duration: 1.5 },
  { type: 'bounce', duration: 2.0 },
]

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const lerp = (a, b, t) => a + (b - a) * t

function FaceDisplay({ currentFace, amplitude, botState }) {
  const meshRef = useRef()
  const matRef = useRef()
  const texturesRef = useRef({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const entries = Object.entries(FACE_TEXTURES)
    let loadCount = 0
    entries.forEach(([key, path]) => {
      loader.load(path, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.flipY = false
        tex.needsUpdate = true
        texturesRef.current[key] = tex
        loadCount++
        if (loadCount === entries.length) {
          setLoaded(true)
        }
      }, undefined, () => {
        loadCount++
        if (loadCount === entries.length) setLoaded(true)
      })
    })
  }, [])

  useFrame((state) => {
    if (!matRef.current || !loaded) return
    const t = state.clock.elapsedTime
    const tex = texturesRef.current[currentFace]
    if (tex && matRef.current.map !== tex) {
      matRef.current.map = tex
      matRef.current.emissiveMap = tex
      matRef.current.needsUpdate = true
    }

    if (botState === BOT_STATE.SPEAKING) {
      const baseGlow = 1.5 + amplitude * 3.0
      const pulse = Math.sin(t * 15) * amplitude * 0.8
      matRef.current.emissiveIntensity = clamp(baseGlow + pulse, 1.0, 5.0)
      matRef.current.opacity = 0.92 + amplitude * 0.08
    } else if (botState === BOT_STATE.LISTENING) {
      matRef.current.emissiveIntensity = 1.2 + amplitude * 2.0 + Math.sin(t * 4) * 0.3
      matRef.current.opacity = 0.9
    } else if (botState === BOT_STATE.THINKING) {
      matRef.current.emissiveIntensity = 0.8 + Math.sin(t * 1.5) * 0.4
      matRef.current.opacity = 0.85
    } else {
      matRef.current.emissiveIntensity = 1.0 + Math.sin(t * 2) * 0.3
      matRef.current.opacity = 0.9
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0.01]} scale={[1, 1, 1]}>
      <planeGeometry args={[0.28, 0.22]} />
      <meshStandardMaterial
        ref={matRef}
        transparent
        opacity={0.9}
        side={THREE.FrontSide}
        emissive={new THREE.Color(0xd4af37)}
        emissiveIntensity={1.0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function RobotModel({ botState, audioAmplitude = 0, mousePos, isHovering }) {
  const group = useRef()
  const { scene, animations } = useGLTF('/robot_avatar/LexAI_Robot_Final.glb')
  const { actions } = useAnimations(animations, group)
  
  const currentActionRef = useRef(null)
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
  
  const smoothAmplitudeRef = useRef(0)
  const speakGestureRef = useRef({ nextTime: 0, active: false, type: 0, startTime: 0, duration: 0 })
  const faceSwapTimerRef = useRef(0)
  const currentFaceIdxRef = useRef(0)
  const headBoneRef = useRef(null)
  const headfrontBoneRef = useRef(null)
  const spineBoneRef = useRef(null)
  const neckBoneRef = useRef(null)
  const breathPhaseRef = useRef(0)
  
  const [currentFace, setCurrentFace] = useState('happy')
  const faceGroupRef = useRef()

  useEffect(() => {
    if (!scene) return
    scene.traverse((obj) => {
      if (obj.name === 'SpeechBubble') speechBubbleRef.current = obj
      if (obj.name === 'Gavel') gavelRef.current = obj
      if (obj.name === 'ParticleAura') auraRef.current = obj
      
      if (obj.isBone) {
        if (obj.name === 'Head') headBoneRef.current = obj
        if (obj.name === 'headfront') headfrontBoneRef.current = obj
        if (obj.name === 'neck') neckBoneRef.current = obj
        if (obj.name === 'Spine02') spineBoneRef.current = obj
      }
    })

    if (speechBubbleRef.current) speechBubbleRef.current.visible = false
    if (gavelRef.current) gavelRef.current.visible = false
    if (auraRef.current) auraRef.current.visible = false

    playAnimation('Wave_Hello', false)
    setTimeout(() => {
      playAnimation('Hover_Float', true)
      setCurrentFace('happy')
    }, 2200)
    
    if (actions['ParticleAura_Spin']) auraActionRef.current = actions['ParticleAura_Spin']
    if (actions['Gavel_Swing']) gavelActionRef.current = actions['Gavel_Swing']
  }, [scene, actions])

  useEffect(() => {
    if (!headfrontBoneRef.current || !faceGroupRef.current) return
    headfrontBoneRef.current.add(faceGroupRef.current)
    return () => {
      if (headfrontBoneRef.current && faceGroupRef.current) {
        headfrontBoneRef.current.remove(faceGroupRef.current)
      }
    }
  }, [scene])

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

  useEffect(() => {
    if (!actions || botState === prevStateRef.current) return
    prevStateRef.current = botState

    const animName = STATE_ANIMATION[botState]
    const isLoop = [BOT_STATE.IDLE, BOT_STATE.SPEAKING, BOT_STATE.LISTENING].includes(botState)
    if (animName) playAnimation(animName, isLoop)

    const face = STATE_FACE[botState]
    if (face) setCurrentFace(face)

    if (botState !== BOT_STATE.IDLE) {
      idleBehaviorRef.current.active = false
    }

    if (botState === BOT_STATE.SPEAKING) {
      speakGestureRef.current = { nextTime: 0, active: false, type: 0, startTime: 0, duration: 0 }
      faceSwapTimerRef.current = 0
      currentFaceIdxRef.current = 0
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
  }, [botState, actions, playAnimation])

  useFrame((state, delta) => {
    if (!group.current) return
    const t = state.clock.elapsedTime

    smoothAmplitudeRef.current = lerp(smoothAmplitudeRef.current, audioAmplitude, 0.15)
    const amp = smoothAmplitudeRef.current

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

    breathPhaseRef.current += delta * 1.2
    const breathScale = 1.0 + Math.sin(breathPhaseRef.current) * 0.003
    group.current.scale.set(breathScale, breathScale, breathScale)

    if (botState === BOT_STATE.SPEAKING) {
      if (headBoneRef.current) {
        headBoneRef.current.rotation.x += Math.sin(t * 3.5) * amp * 0.1
        headBoneRef.current.rotation.z += Math.sin(t * 2.1) * amp * 0.04
      }
      if (neckBoneRef.current) {
        neckBoneRef.current.rotation.y += Math.sin(t * 1.2) * amp * 0.03
      }
      if (spineBoneRef.current) {
        spineBoneRef.current.rotation.z = Math.sin(t * 1.5) * amp * 0.03
      }

      group.current.position.y = Math.sin(t * 2.5) * amp * 0.02

      faceSwapTimerRef.current += delta
      const swapInterval = amp > 0.3 ? 0.12 : amp > 0.1 ? 0.22 : 0.35
      if (faceSwapTimerRef.current > swapInterval && amp > 0.03) {
        faceSwapTimerRef.current = 0
        currentFaceIdxRef.current = (currentFaceIdxRef.current + 1) % SPEAKING_FACE_CYCLE.length
        setCurrentFace(SPEAKING_FACE_CYCLE[currentFaceIdxRef.current])
      }

      const gesture = speakGestureRef.current
      if (!gesture.active && t > gesture.nextTime) {
        gesture.active = true
        gesture.type = Math.floor(Math.random() * 4)
        gesture.startTime = t
        gesture.duration = 1.0 + Math.random() * 1.5
      }
      if (gesture.active) {
        const gProgress = (t - gesture.startTime) / gesture.duration
        if (gProgress >= 1) {
          gesture.active = false
          gesture.nextTime = t + 0.5 + Math.random() * 2.0
        } else {
          const gEase = Math.sin(gProgress * Math.PI)
          switch (gesture.type) {
            case 0:
              baseGroupRotY.current += Math.sin(gProgress * Math.PI) * 0.06 * gEase
              break
            case 1:
              if (headBoneRef.current) {
                headBoneRef.current.rotation.x += Math.sin(gProgress * Math.PI * 2) * 0.05 * gEase
              }
              break
            case 2:
              group.current.position.y += Math.sin(gProgress * Math.PI * 2) * 0.012 * gEase
              break
            case 3:
              if (headBoneRef.current) {
                headBoneRef.current.rotation.z += Math.sin(gProgress * Math.PI) * 0.06 * gEase
              }
              break
          }
        }
      }

    } else if (botState === BOT_STATE.LISTENING) {
      group.current.position.y = Math.sin(t * 2) * 0.01 + amp * 0.02
      if (headBoneRef.current) {
        headBoneRef.current.rotation.x += Math.sin(t * 1.5) * 0.03
        headBoneRef.current.rotation.z += Math.sin(t * 0.8) * 0.02
      }

    } else if (botState === BOT_STATE.THINKING) {
      group.current.position.y = Math.sin(t * 0.6) * 0.01
      if (headBoneRef.current) {
        headBoneRef.current.rotation.z = Math.sin(t * 0.5) * 0.04
        headBoneRef.current.rotation.x = -0.04 + Math.sin(t * 0.3) * 0.02
      }

    } else if (botState === BOT_STATE.IDLE) {
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
          group.current.rotation.z = 0
          group.current.rotation.x = 0
          nextIdleTimeRef.current = t + 2 + Math.random() * 4
        } else {
          const ease = Math.sin(progress * Math.PI)
          
          switch (idle.type) {
            case 'lookAround':
              baseGroupRotY.current += Math.sin(progress * Math.PI * 2) * 0.15 * ease * 0.3
              break
            case 'tiltHead':
              group.current.rotation.z = Math.sin(progress * Math.PI) * 0.06
              break
            case 'swirl':
              baseGroupRotY.current += Math.sin(progress * Math.PI * 2) * 0.015
              baseGroupPosY.current = Math.sin(progress * Math.PI * 3) * 0.04
              break
            case 'nod':
              group.current.rotation.x = Math.sin(progress * Math.PI * 3) * 0.04 * ease
              break
            case 'bounce':
              baseGroupPosY.current = Math.sin(progress * Math.PI * 4) * 0.03 * ease
              break
          }
          group.current.position.y = baseGroupPosY.current
        }
      }

      group.current.position.y += Math.sin(t * 0.8) * 0.003
    }

    const blinkCycle = Math.sin(t * 0.7) * Math.sin(t * 1.3)
    const isBlinking = blinkCycle > 0.97 && botState !== BOT_STATE.SPEAKING
    if (headfrontBoneRef.current) {
      if (isBlinking) {
        headfrontBoneRef.current.scale.y = lerp(headfrontBoneRef.current.scale.y, 0.1, 0.4)
      } else {
        headfrontBoneRef.current.scale.y = lerp(headfrontBoneRef.current.scale.y, 1.0, 0.2)
      }
    }

    if (speechBubbleRef.current && speechBubbleRef.current.visible) {
      speechBubbleRef.current.position.y = 0.6 + Math.sin(t * 2) * 0.03
      speechBubbleRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05)
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
      <group ref={faceGroupRef}>
        <FaceDisplay currentFace={currentFace} amplitude={smoothAmplitudeRef.current} botState={botState} />
      </group>
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
        camera={{ position: [0, 1.0, 3.5], fov: 40 }}
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
