'use client'

import { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<number>(1)
  const [messageText, setMessageText] = useState('')

  const conversations = [
    { id: 1, user: 'Sarah Johnson', twin: 'John Doe - Main', lastMessage: 'Thanks for the help!', time: '2 mins' },
    { id: 2, user: 'Mike Chen', twin: 'John Doe - Sales', lastMessage: 'When can we schedule?', time: '15 mins' },
    { id: 3, user: 'Emma Davis', twin: 'John Doe - Main', lastMessage: 'Perfect, thank you', time: '1 hour' },
  ]

  const messages = [
    { id: 1, sender: 'user', text: 'Hi, can you help me with something?', timestamp: '10:30 AM' },
    { id: 2, sender: 'twin', text: 'Of course! I\'d be happy to help. What do you need assistance with?', timestamp: '10:31 AM' },
    { id: 3, sender: 'user', text: 'I have questions about your services', timestamp: '10:32 AM' },
    { id: 4, sender: 'twin', text: 'Great! I offer a wide range of services. Let me know what you\'re interested in and I\'ll provide all the details.', timestamp: '10:33 AM' },
    { id: 5, sender: 'user', text: 'Thanks for the help!', timestamp: '10:34 AM' },
  ]

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-md px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Live Chat</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage conversations</p>
        </div>

        {/* Chat Interface */}
        <div className="flex flex-1 min-h-0">
          {/* Conversation List */}
          <div className="w-64 border-r border-border bg-card/50 overflow-auto">
            <div className="p-4 space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedConversation === conv.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-foreground text-sm">{conv.user}</p>
                    <p className="text-xs text-muted-foreground">{conv.time}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{conv.twin}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-auto px-8 py-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs mt-1 opacity-70">{msg.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card/50 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button className="bg-gradient-primary hover:opacity-90">Send</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
