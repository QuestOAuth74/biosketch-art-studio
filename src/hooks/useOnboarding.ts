import { useState, useEffect } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string; // Optional action prompt
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to BioSketch! 🎨',
    description: 'Let\'s take a quick tour to help you create your first scientific illustration. This will only take 2 minutes.',
    target: '',
    position: 'center',
  },
  {
    id: 'toolbar',
    title: 'Main Toolbar',
    description: 'This is your main toolbar. Here you can select tools, add shapes, insert text, and more.',
    target: '[data-onboarding="toolbar"]',
    position: 'bottom',
  },
  {
    id: 'shapes',
    title: 'Adding Shapes',
    description: 'Click on "Shapes" to add basic geometric shapes like rectangles, circles, and more to your canvas.',
    target: '[data-onboarding="shapes-dropdown"]',
    position: 'bottom',
    action: 'Click "Shapes" to continue',
  },
  {
    id: 'icons',
    title: 'Icon Library',
    description: 'Access 5,000+ scientific icons from the left panel. Search by keyword or browse by category.',
    target: '[data-onboarding="icon-library"]',
    position: 'right',
  },
  {
    id: 'connectors',
    title: 'Drawing Connectors',
    description: 'Use line tools to connect shapes and create pathways. Choose from straight, curved, or orthogonal lines.',
    target: '[data-onboarding="lines-section"]',
    position: 'bottom',
    action: 'Try clicking a line tool',
  },
  {
    id: 'properties',
    title: 'Properties Panel',
    description: 'Select any object to customize its properties: colors, borders, opacity, and more.',
    target: '[data-onboarding="properties-panel"]',
    position: 'left',
  },
  {
    id: 'export',
    title: 'Export Your Work',
    description: 'When you\'re done, use the "Export" button in the menu bar to download your illustration in various formats.',
    target: '[data-onboarding="menu-bar"]',
    position: 'bottom',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    description: 'You now know the basics! Start creating your scientific illustrations. You can always access help from the menu.',
    target: '',
    position: 'center',
  },
];

const ONBOARDING_STORAGE_KEY = 'biosketch_onboarding_completed';

export const useOnboarding = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      // Show onboarding for first-time users after a short delay
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsCompleted(true);
    }
  }, []);

  const startOnboarding = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeOnboarding();
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsActive(false);
    setIsCompleted(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setIsCompleted(false);
    setCurrentStepIndex(0);
  };

  return {
    isActive,
    currentStep: ONBOARDING_STEPS[currentStepIndex],
    currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    isCompleted,
    startOnboarding,
    nextStep,
    previousStep,
    skipOnboarding,
    resetOnboarding,
  };
};
