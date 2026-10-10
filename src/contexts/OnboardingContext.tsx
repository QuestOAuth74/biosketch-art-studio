import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action: 'click' | 'drag' | 'modify' | 'add' | 'connect';
  actionDescription: string;
  successMessage: string;
  hint?: string;
  detectCompletion: (data?: any) => boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome! Let's Create Your First Figure 🎨",
    description: "This interactive tutorial will guide you through creating a simple diagram. Each step requires you to perform an action.",
    target: "#canvas-container",
    position: "bottom",
    action: "click",
    actionDescription: "Click 'Next' to begin",
    successMessage: "Great! Let's get started!",
    detectCompletion: () => true,
  },
  {
    id: "add-rectangle",
    title: "Step 1: Add a Rectangle",
    description: "Click the Rectangle tool, then click anywhere on the canvas to add your first shape.",
    target: "[data-tool='rectangle']",
    position: "right",
    action: "add",
    actionDescription: "Add a rectangle to the canvas",
    successMessage: "🎉 Perfect! You added your first shape!",
    hint: "Tip: Click the rectangle icon in the toolbar, then click on the canvas",
    detectCompletion: (data) => data?.type === 'rect',
  },
  {
    id: "drag-shape",
    title: "Step 2: Move Your Shape",
    description: "Click and drag the rectangle to move it around. Try positioning it in the center.",
    target: "#canvas-container",
    position: "top",
    action: "drag",
    actionDescription: "Drag the rectangle to move it",
    successMessage: "✨ Nice! You can move any object like this!",
    hint: "Click on the shape and drag it with your mouse",
    detectCompletion: (data) => data?.moved === true,
  },
  {
    id: "change-color",
    title: "Step 3: Change the Color",
    description: "With the rectangle selected, use the color picker in the right panel to change its color.",
    target: "[data-panel='properties']",
    position: "left",
    action: "modify",
    actionDescription: "Change the rectangle's fill color",
    successMessage: "🎨 Beautiful! Color customization mastered!",
    hint: "Look for the color picker in the Properties panel on the right",
    detectCompletion: (data) => data?.colorChanged === true,
  },
  {
    id: "add-text",
    title: "Step 4: Add a Label",
    description: "Click the Text tool, then click on the canvas to add a text label.",
    target: "[data-tool='text']",
    position: "right",
    action: "add",
    actionDescription: "Add text to the canvas",
    successMessage: "📝 Excellent! You can now add labels to your figures!",
    hint: "Click the 'T' icon in the toolbar, then click on the canvas and type",
    detectCompletion: (data) => data?.type === 'textbox',
  },
  {
    id: "add-arrow",
    title: "Step 5: Connect with an Arrow",
    description: "Click the Arrow tool, then draw an arrow connecting your shapes.",
    target: "[data-tool='arrow']",
    position: "right",
    action: "add",
    actionDescription: "Draw an arrow on the canvas",
    successMessage: "➡️ Great! You can now show relationships between elements!",
    hint: "Click the arrow icon, then click and drag on the canvas to draw",
    detectCompletion: (data) => data?.hasArrow === true,
  },
  {
    id: "complete",
    title: "🎉 Tutorial Complete!",
    description: "You've learned the basics! You created shapes, moved them, changed colors, added text, and drew connections. You're ready to create amazing scientific figures!",
    target: "[data-action='save']",
    position: "bottom",
    action: "click",
    actionDescription: "Start creating your own figures!",
    successMessage: "Welcome to BioSketch! 🚀",
    detectCompletion: () => true,
  }
];

const ONBOARDING_STORAGE_KEY = 'biosketch-onboarding-completed';

interface OnboardingContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  isCompleted: boolean;
  progress: number;
  completedSteps: string[];
  startOnboarding: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  completeCurrentStep: (data?: any) => void;
  markStepCompleted: (stepId: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Calculate progress percentage
  const progress = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);

  // Check if user has completed onboarding before
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    setIsCompleted(completed);
  }, []);

  const startOnboarding = () => {
    setIsActive(true);
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setCompletedSteps([]);
  };

  const markStepCompleted = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId]);
    }
  };

  const completeCurrentStep = (data?: any) => {
    const currentStep = ONBOARDING_STEPS[currentStepIndex];
    
    // Check if the step is actually completed based on the detection logic
    if (currentStep && currentStep.detectCompletion(data)) {
      markStepCompleted(currentStep.id);
      
      // Auto-advance to next step after a short delay for user to see success
      setTimeout(() => {
        nextStep();
      }, 1500);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const skipOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const completeOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setIsCompleted(false);
    setCurrentStepIndex(0);
    setCompletedSteps([]);
    setIsActive(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStepIndex,
        currentStep: isActive ? ONBOARDING_STEPS[currentStepIndex] : null,
        isCompleted,
        progress,
        completedSteps,
        startOnboarding,
        nextStep,
        previousStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        completeCurrentStep,
        markStepCompleted,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
