export declare const BOT_STATE: {
  IDLE: string;
  LISTENING: string;
  THINKING: string;
  SPEAKING: string;
  ERROR: string;
};

export interface LexAIRobotProps {
  botState?: string;
  [key: string]: unknown;
}

declare const LexAIRobot: (props: LexAIRobotProps) => JSX.Element;
export default LexAIRobot;
