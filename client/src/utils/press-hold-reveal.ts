// Press and Hold Reveal Utility for Secret Fields
import React, { useCallback, useRef, useEffect, useState } from 'react';

export interface UsePressHoldRevealOptions {
  holdDurationMs?: number;
  onRevealStart?: () => void;
  onRevealEnd?: () => void;
}

export interface PressHoldRevealState {
  isRevealed: boolean;
  isHolding: boolean;
  canReveal: boolean; // true if there's content to reveal
}

export interface PressHoldRevealHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
}

/**
 * Custom hook for press-and-hold reveal functionality
 * Used for revealing secret fields like API keys
 */
export function usePressHoldReveal(
  content: string | undefined,
  options: UsePressHoldRevealOptions = {}
): [PressHoldRevealState, PressHoldRevealHandlers] {
  const {
    holdDurationMs = 800,
    onRevealStart,
    onRevealEnd
  } = options;

  const [isRevealed, setIsRevealed] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canReveal = Boolean(content && content.trim().length > 0);

  const startHold = useCallback(() => {
    if (!canReveal) return;
    
    setIsHolding(true);
    onRevealStart?.();
    
    timeoutRef.current = setTimeout(() => {
      setIsRevealed(true);
      setIsHolding(false);
    }, holdDurationMs);
  }, [canReveal, holdDurationMs, onRevealStart]);

  const endHold = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsHolding(false);
    setIsRevealed(false);
    onRevealEnd?.();
  }, [onRevealEnd]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback(() => {
    startHold();
  }, [startHold]);

  const handleMouseUp = useCallback(() => {
    endHold();
  }, [endHold]);

  const handleMouseLeave = useCallback(() => {
    endHold();
  }, [endHold]);

  const handleTouchStart = useCallback(() => {
    startHold();
  }, [startHold]);

  const handleTouchEnd = useCallback(() => {
    endHold();
  }, [endHold]);

  const handleTouchCancel = useCallback(() => {
    endHold();
  }, [endHold]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Space or Enter to reveal
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isHolding) {
        startHold();
      }
    }
  }, [isHolding, startHold]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      endHold();
    }
  }, [endHold]);

  const state: PressHoldRevealState = {
    isRevealed,
    isHolding,
    canReveal
  };

  const handlers: PressHoldRevealHandlers = {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp
  };

  return [state, handlers];
}

/**
 * Utility function to get display value for secret fields
 */
export function getSecretDisplayValue(
  isRevealed: boolean,
  content: string | undefined,
  placeholder = '••••••••••••'
): string {
  if (!content || content.trim().length === 0) {
    return '';
  }
  
  return isRevealed ? content : placeholder;
}

/**
 * Component for revealing secret text with press-and-hold
 */
export interface SecretRevealProps {
  value: string | undefined;
  className?: string;
  placeholder?: string;
  holdDurationMs?: number;
  'aria-label'?: string;
}

/**
 * Utility component for displaying secret values with reveal functionality
 * Used inline in forms where you need to show/hide secret content
 */
export function SecretReveal({
  value,
  className = '',
  placeholder = '••••••••••••',
  holdDurationMs = 800,
  'aria-label': ariaLabel = 'Press and hold to reveal secret'
}: SecretRevealProps) {
  const [state, handlers] = usePressHoldReveal(value, { holdDurationMs });
  
  const displayValue = getSecretDisplayValue(state.isRevealed, value, placeholder);
  const hasValue = Boolean(value && value.trim().length > 0);
  
  if (!hasValue) {
    return React.createElement('span', { 
      className: `text-gray-400 ${className}` 
    }, 'No value set');
  }

  return React.createElement('span', {
    className: `inline-flex items-center gap-2 ${className}`,
    ...handlers,
    role: "button",
    tabIndex: 0,
    'aria-label': ariaLabel,
    style: { userSelect: 'none' }
  }, [
    React.createElement('code', {
      key: 'code',
      className: "font-mono text-sm bg-gray-100 px-2 py-1 rounded"
    }, displayValue),
    
    state.canReveal && React.createElement('span', {
      key: 'status',
      className: "text-xs text-gray-500"
    }, state.isHolding ? 'Hold...' : state.isRevealed ? 'Revealed' : 'Hold to reveal')
  ]);
}