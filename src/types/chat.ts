export interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
}


