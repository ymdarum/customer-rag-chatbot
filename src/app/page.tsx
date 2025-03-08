/**
 * Customer RAG Chatbot
 * A chatbot interface for querying customer information using RAG (Retrieval Augmented Generation).
 * This uses a SQLite database to store vector embeddings for efficient retrieval
 * and then generates responses using LLM (Ollama).
 */

import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Chat from '@/components/Chat';

export const metadata: Metadata = {
  title: 'Customer RAG Chatbot',
  description: 'A chatbot for querying customer information using RAG with Ollama',
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-primary px-4 lg:px-6 h-16 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="CRM Logo" 
              width={40} 
              height={40}
              className="rounded-sm"
            />
            <h1 className="text-lg font-semibold text-white">
              Customer RAG Chatbot
            </h1>
          </div>
          <nav className="flex gap-4 sm:gap-6">
            <Link
              href="https://github.com/your-username/customer-rag-chatbot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline text-white"
            >
              GitHub
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium hover:underline text-white"
            >
              Docs
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1 container flex flex-col items-center gap-4 p-4 md:p-8">
        <div className="max-w-3xl w-full grid gap-4 my-4">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Customer Support Assistant
            </h1>
            <p className="text-muted-foreground text-lg">
              A RAG-powered chatbot for finding and answering questions about customer data
            </p>
          </div>
          <div className="flex-1 flex flex-col space-y-4">
            <Chat />
          </div>
        </div>
      </div>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} Customer RAG Chatbot. 
            Built with Ollama, Next.js, and Shadcn UI.
          </p>
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/privacy">Privacy</Link>
            </Button>
          </div>
        </div>
      </footer>
    </main>
  )
}
