import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, Environment } from '@react-three/drei'
import * as THREE from 'three'

// ─── BOT STATES ──────────────────────────────────────────────────────────────
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

// ─── STATE → ANIMATION MAP ───────────────────────────────────────────────────
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

// ─── STATE → FACE MAP ────────────────────────────────────────────────────────
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

// ─── ROBOT INNER COMPONENT ───────────────────────────────────────────────────
function RobotModel({ botState, audioAmplitude = 0 }) {
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

  // ── Find prop nodes on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!scene) return
    scene.traverse((obj) => {
      if (obj.name === 'SpeechBubble') speechBubbleRef.current = obj
      if (obj.name === 'Gavel') gavelRef.current = obj
      if (obj.name === 'ParticleAura') auraRef.current = obj
      
      // Improved face mesh detection
      if (obj.isMesh && (obj.name.toLowerCase().includes('face') || obj.name.toLowerCase().includes('screen'))) {
        faceMeshRef.current = obj
      }
    })

    // Hide all props initially
    if (speechBubbleRef.current) speechBubbleRef.current.visible = false
    if (gavelRef.current) gavelRef.current.visible = false
    if (auraRef.current) auraRef.current.visible = false

    // Start with greeting
    playAnimation('Wave_Hello', false)
    setTimeout(() => playAnimation('Hover_Float', true), 2200)
    
    // Setup aura animation ref
    if (actions['ParticleAura_Spin']) auraActionRef.current = actions['ParticleAura_Spin']
    if (actions['Gavel_Swing']) gavelActionRef.current = actions['Gavel_Swing']
  }, [scene, actions])

  // ── Play animation with crossfade ─────────────────────────────────────────
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

  // ── Update face texture with improved LED glow ────────────────────────────
  const updateFace = useCallback((texturePath) => {
    if (!faceMeshRef.current) return
    const loader = new THREE.TextureLoader()
    loader.load(texturePath, (tex) => {
      tex.encoding = THREE.sRGBEncoding
      tex.flipY = false // GLTF textures usually need this
      
      if (faceMeshRef.current.material) {
        // Create a clone to avoid modifying shared material
        if (!faceTextureRef.current) {
          faceMeshRef.current.material = faceMeshRef.current.material.clone()
        }
        
        // Enhance LED expression visibility
        faceMeshRef.current.material.map = tex
        faceMeshRef.current.material.emissiveMap = tex
        
        // Golden/Amber glow to match Chakshi theme
        faceMeshRef.current.material.emissive = new THREE.Color(0xd4af37) 
        faceMeshRef.current.material.emissiveIntensity = 3.5 // Increased for better visibility
        faceMeshRef.current.material.transparent = true
        faceMeshRef.current.material.needsUpdate = true
        faceTextureRef.current = tex
      }
    })
  }, [])

  // ── React to bot state changes ────────────────────────────────────────────
  useEffect(() => {
    if (!actions || botState === prevStateRef.current) return
    prevStateRef.current = botState

    // Play animation
    const animName = STATE_ANIMATION[botState]
    const isLoop = [BOT_STATE.IDLE, BOT_STATE.SPEAKING, BOT_STATE.LISTENING].includes(botState)
    if (animName) playAnimation(animName, isLoop)

    // Update face texture
    const faceTex = STATE_FACE[botState]
    if (faceTex) updateFace(faceTex)

    // Handle props
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

  // ── Procedural animation frame ────────────────────────────────────────────
  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime

    // Head tracking toward cursor (subtle)
    const mx = (state.mouse.x * 0.15)
    const my = (state.mouse.y * 0.08)
    
    scene.traverse((obj) => {
      if (obj.name === 'Head' && obj.isBone) {
        obj.rotation.y += (mx - obj.rotation.y) * 0.05
        obj.rotation.x += (my - obj.rotation.x) * 0.05
      }
    })

    // Voice amplitude drives head bob and subtle emissive pulsing
    if (botState === BOT_STATE.SPEAKING && audioAmplitude > 0) {
      scene.traverse((obj) => {
        if (obj.name === 'Head' && obj.isBone) {
          obj.rotation.x += Math.sin(t * 12) * audioAmplitude * 0.06
        }
      })
      if (faceMeshRef.current?.material) {
        faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 20) * audioAmplitude * 2.0
      }
    } else if (faceMeshRef.current?.material) {
      // Subtle pulse when idle
      faceMeshRef.current.material.emissiveIntensity = 2.0 + Math.sin(t * 2) * 0.5
    }

    // Random blink via headfront bone scale
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

// ─── MAIN EXPORT COMPONENT ───────────────────────────────────────────────────
export default function LexAIRobot({ 
  botState = BOT_STATE.IDLE,
  audioAmplitude = 0,
  className = ''
}) {
  return (
    <div className={`lexai-robot-container ${className}`} style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        camera={{ position: [0, 0.8, 2.2], fov: 45 }}
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
        
        <RobotModel botState={botState} audioAmplitude={audioAmplitude} />
        
        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/robot_avatar/LexAI_Robot_Final.glb')
