"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Navbar from "@/components/Navbar";

type Event = {
  id: string;
  title: string;
  date: string;
  place: string;
};

function SearchContent() {
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("keyword") || "";
  const [keyword, setKeyword] = useState(initialKeyword);
  const [results, setResults] = useState<Event[]>([]);

  const searchEvents = async (kw: string) => {
    try {
      const q = query(collection(db, "events"), orderBy("date", "asc"));
      const snapshot = await getDocs(q);

      const filtered: Event[] = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Event))
        .filter((event) => {
          if (!kw) return true;
          const lower = kw.toLowerCase();
          return (
            event.title.toLowerCase().includes(lower) ||
            event.place.toLowerCase().includes(lower)
          );
        });

      setResults(filtered);
    } catch (e) {
      console.error("Error searching events:", e);
    }
  };

  useEffect(() => {
    searchEvents(initialKeyword);
  }, [initialKeyword]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-sky-700">🔍 オフ会検索</h1>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-4 mb-6">
        <input
          type="text"
          placeholder="タイトルや場所で検索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={() => searchEvents(keyword)}
          className="w-full px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600"
        >
          検索する
        </button>
      </div>

      {results.length === 0 ? (
        <p className="text-gray-600">検索結果はありません。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((event) => (
            <div
              key={event.id}
              className="bg-white p-4 rounded-lg shadow border hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-blue-700">{event.title}</h2>
              <p className="text-gray-600">📅 {event.date}</p>
              <p className="text-gray-600">📍 {event.place}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Navbar />
      <Suspense fallback={<p className="text-center mt-20 text-gray-400">読み込み中...</p>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}