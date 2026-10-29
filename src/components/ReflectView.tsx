import React, { useState } from 'react';
import { Smile, BookOpen, TrendingUp, Sparkles } from 'lucide-react';
import { MoodEntry, JournalEntry } from '../types';
import { MoodTracker } from './MoodTracker';
import { JournalView } from './JournalView';

interface Props {
  moods: MoodEntry[];
  entries: JournalEntry[];
  onSaveMood: (entry: Omit<MoodEntry, 'id' | 'timestamp'>) => void;
  onDeleteMood: (id: string) => void;
  onSaveJournalEntry: (entry: { title: string; content: string; promptUsed?: string; tags?: string[] }, id?: string) => void;
  onDeleteJournalEntry: (id: string) => void;
  onShareWithKalise: (text: string) => void;
}

export const ReflectView: React.FC<Props> = ({
  moods,
  entries,
  onSaveMood,
  onDeleteMood,
  onSaveJournalEntry,
  onDeleteJournalEntry,
  onShareWithKalise,
}) => {
  const [subTab, setSubTab] = useState<'mood' | 'journal'>('mood');

  return (
    <div className="space-y-6 pb-24 pt-2 animate-in fade-in duration-300">
      {/* Reflective Header & Sub-Tab Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 font-serif">Reflect & Process</h1>
          <p className="text-xs text-slate-400 mt-0.5">Your daily emotional check-in and private journal.</p>
        </div>

        <div className="flex p-1 rounded-2xl bg-slate-800/80 border border-slate-700">
          <button
            onClick={() => setSubTab('mood')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              subTab === 'mood'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Mood Check-In</span>
          </button>
          <button
            onClick={() => setSubTab('journal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              subTab === 'journal'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Private Journal</span>
          </button>
        </div>
      </div>

      {subTab === 'mood' ? (
        <MoodTracker
          moods={moods}
          onSaveMood={onSaveMood}
          onDeleteMood={onDeleteMood}
        />
      ) : (
        <JournalView
          entries={entries}
          onSaveEntry={onSaveJournalEntry}
          onDeleteEntry={onDeleteJournalEntry}
          onShareWithKalise={onShareWithKalise}
        />
      )}
    </div>
  );
};
