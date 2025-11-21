import type { Metadata } from 'next'
import './globals.css'
import { PlanProvider } from '@/contexts/plan-context'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bilibou',
  description: 'Gestion de factures',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Script de nettoyage des cookies AVANT tout le reste */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cookies = document.cookie.split(';');
                  var needsCleanup = false;
                  var supabaseCookies = [];
                  
                  for (var i = 0; i < cookies.length; i++) {
                    var cookie = cookies[i].trim();
                    var name = cookie.split('=')[0];
                    
                    if (name.startsWith('sb-')) {
                      supabaseCookies.push(name);
                      var value = cookie.split('=')[1];
                      
                      // Si cookie vide ou trop court = corrompu
                      if (!value || value.length < 20) {
                        needsCleanup = true;
                      }
                    }
                  }
                  
                  // Si au moins un cookie corrompu, tout nettoyer
                  if (needsCleanup) {
                    console.warn('🧹 Nettoyage des cookies Supabase corrompus (avant chargement app)');
                    
                    for (var j = 0; j < supabaseCookies.length; j++) {
                      var cookieName = supabaseCookies[j];
                      document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
                    }
                    
                    // Marquer comme nettoyé pour éviter les boucles de reload
                    if (!sessionStorage.getItem('cookies_cleaned')) {
                      sessionStorage.setItem('cookies_cleaned', 'true');
                      window.location.reload();
                    }
                  }
                } catch (e) {
                  console.error('Erreur nettoyage cookies:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <PlanProvider>
          {children}
        </PlanProvider>
        <Analytics />
      </body>
    </html>
  )
}
