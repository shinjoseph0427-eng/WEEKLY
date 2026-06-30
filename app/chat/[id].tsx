// Solo chat (realtime) — web SoloChatPage.jsx. Body is a placeholder this phase;
// the ported chat logic lives in src/features/chat/.
import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '../../src/ui/Placeholder';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder title="Chat" note={`Match ${id ?? ''}`} />;
}
