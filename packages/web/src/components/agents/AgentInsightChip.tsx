import type { AgentId } from '../../agents/types.js';

export interface AgentInsightChipProps {
  agentId: AgentId;
  agentName: string;
  message: string;
  tone?: 'info' | 'warn' | 'action';
  onClick?: () => void;
}

const TONE_CLASS = {
  info: 'agent-chip agent-chip--info',
  warn: 'agent-chip agent-chip--warn',
  action: 'agent-chip agent-chip--action',
};

export default function AgentInsightChip({
  agentId,
  agentName,
  message,
  tone = 'info',
  onClick,
}: AgentInsightChipProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={TONE_CLASS[tone]}
      data-agent={agentId}
      onClick={onClick}
    >
      <span className="agent-chip__icon" aria-hidden>◇</span>
      <span className="agent-chip__name">{agentName}</span>
      <span className="agent-chip__msg">{message}</span>
    </Tag>
  );
}
