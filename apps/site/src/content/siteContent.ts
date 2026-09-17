export type LearningMode = 'explain' | 'guide' | 'challenge'

export interface LearningModeContent {
  label: string
  context: string
  response: string
  action: string
  activeLine: number
}

export const modeContent: Record<LearningMode, LearningModeContent> = {
  explain: {
    label: 'Explain',
    context: 'Understanding the screen',
    response:
      'This effect runs after the component appears. Because the dependency list is empty, React has no reason to run it again.',
    action: 'Show me why',
    activeLine: 2,
  },
  guide: {
    label: 'Guide',
    context: 'Working one step at a time',
    response:
      'Add users to the dependency list on line 4. I’ll wait for your change, then we can check what happened.',
    action: 'Check my change',
    activeLine: 4,
  },
  challenge: {
    label: 'Challenge',
    context: 'Practising without the answer',
    response:
      'Make this effect run whenever the users list changes. You can ask for a small hint if you get stuck.',
    action: 'Give me a hint',
    activeLine: 4,
  },
}

export const frequentlyAskedQuestions = [
  {
    question: 'What can I learn with Truly?',
    answer:
      'Truly is designed for visible, practical work: code, creative tools, technical workflows, and other skills where seeing the current screen makes the explanation more useful. The first complete Skill teaches React Effects.',
  },
  {
    question: 'Does Truly watch my screen in the background?',
    answer:
      'No. Truly is designed to capture the screen only when you deliberately ask for help. The capture state is visible, and screenshots are not stored by Truly as a hidden history.',
  },
  {
    question: 'Can Truly control my Mac?',
    answer:
      'No. Truly can point to an area and guide your next action, but you remain in control of the keyboard, pointer, software, and wallet. It teaches rather than operating the computer for you.',
  },
  {
    question: 'Why does Truly connect to Nimiq Pay?',
    answer:
      'Nimiq Pay gives Truly a user-controlled identity and payment layer. It lets you approve a Mac, unlock creator-made Skills with NIM, and keep progress connected without giving Truly access to wallet keys.',
  },
  {
    question: 'Do I need to pay to start learning?',
    answer:
      'No. The competition experience includes a free React Effects Skill. Some creator-made Skills may be unlocked with NIM later, with the exact amount shown before Nimiq Pay asks for approval.',
  },
  {
    question: 'When will the macOS app be available?',
    answer:
      'The first native macOS learning loop is ready for local testing now. A public download will follow after capture, guidance, privacy controls, and recovery states have been tested across real Macs.',
  },
]
