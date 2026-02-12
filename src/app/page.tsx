import Link from 'next/link';
import { Search, Database, Compass } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <h1 className="text-4xl font-bold text-red-900 mb-4">Pinspector</h1>
      <p className="text-gray-600 text-lg mb-12 text-center max-w-xl">
        Pinterest Ideas Analyzer - Finde und analysiere Pinterest Interessen für SEO und Content-Recherche
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Link
          href="/search"
          className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
            <Search className="w-8 h-8 text-red-700" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Search</h2>
          <p className="text-gray-500 text-center text-sm">
            Pinterest Ideas URLs analysieren und Daten extrahieren
          </p>
        </Link>

        <Link
          href="/interests"
          className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
            <Database className="w-8 h-8 text-red-700" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Interests</h2>
          <p className="text-gray-500 text-center text-sm">
            Alle gespeicherten Interessen durchsuchen und exportieren
          </p>
        </Link>

        <Link
          href="/find"
          className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
            <Compass className="w-8 h-8 text-red-700" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Find</h2>
          <p className="text-gray-500 text-center text-sm">
            Neue Pinterest Interessen über Google-Suche entdecken
          </p>
        </Link>
      </div>
    </div>
  );
}
