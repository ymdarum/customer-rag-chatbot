'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

// Define types for our application
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type CustomerMatch = {
  id: string;
  name: string;
};

/**
 * Chat component for interacting with the RAG chatbot
 * This component handles sending messages to the API and displaying responses
 */
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /**
   * Handle form submission to send user queries to the API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    if (!input.trim()) return;
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Send query to the chat API endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add assistant message to chat
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Update matched customers if provided
      if (data.matchedCustomers && Array.isArray(data.matchedCustomers)) {
        setMatches(data.matchedCustomers);
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error('Error querying customer data:', error);
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again later.',
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500" />
            <span className="font-medium">Customer Assistant</span>
          </div>
          {matches.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Found {matches.length} relevant customer{matches.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[60vh] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground my-20">
              <h3 className="text-lg font-semibold mb-2">Welcome to the Customer Assistant!</h3>
              <p>Ask me anything about our customers and their financial products.</p>
              <div className="mt-6 space-y-2 text-sm">
                <p className="font-medium">Example questions:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>What products does customer CUST-100042 have?</li>
                  <li>Tell me about John Smith's recent transactions</li>
                  <li>Which customers have a savings account?</li>
                  <li>What is Maria Garcia's email address?</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className="flex gap-2 max-w-[80%]">
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 bg-primary">
                      <span className="text-xs text-white font-bold">AI</span>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 bg-blue-600">
                      <span className="text-xs text-white font-bold">You</span>
                    </Avatar>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2">
                <Avatar className="h-8 w-8 bg-primary">
                  <span className="text-xs text-white font-bold">AI</span>
                </Avatar>
                <div className="rounded-lg px-4 py-2 bg-muted">
                  <div className="flex space-x-2 items-center h-6">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {matches.length > 0 && !isLoading && (
            <div className="mt-4">
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground mb-1">Relevant customers:</p>
              <div className="flex flex-wrap gap-2">
                {matches.map((customer) => (
                  <div
                    key={customer.id}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                  >
                    {customer.name} ({customer.id})
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t bg-muted/50">
        <form onSubmit={handleSubmit} className="w-full flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about customer information..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Thinking...' : 'Send'}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
} 