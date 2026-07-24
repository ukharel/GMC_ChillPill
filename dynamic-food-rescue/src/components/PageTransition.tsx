import { motion } from 'framer-motion'
import React from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade'
}

export const PageTransition = ({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: PageTransitionProps) => {
  // Define direction mappings
  const directionMap = {
    up: { x: 0, y: 20 },
    down: { x: 0, y: -20 },
    left: { x: 20, y: 0 },
    right: { x: -20, y: 0 },
    fade: { x: 0, y: 0 },
  }

  const initial = { opacity: 0, ...directionMap[direction] }
  const animate = { opacity: 1, x: 0, y: 0 }
  const exit = { opacity: 0, ...directionMap[direction] }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.1, 0.25, 1], // smooth cubic-bezier
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}