import { useGreetings } from "@/hooks/use-greetings";
import { motion } from "framer-motion";

export default function Home() {
  const { data: greetings, isLoading, error } = useGreetings();

  // Determine the message to display
  // If we have greetings from the API, use the first one's message, otherwise fallback
  const message = greetings && greetings.length > 0 
    ? greetings[0].message 
    : "Привет, мир!";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background bg-subtle-gradient relative overflow-hidden">
      
      {/* Abstract decorative elements */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />

      <main className="z-10 px-6 text-center max-w-4xl mx-auto">
        
        {/* Loading State */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-1 bg-primary/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-64, 64] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
              />
            </div>
            <p className="text-sm text-muted-foreground font-sans">Connecting...</p>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive font-medium bg-destructive/5 px-6 py-4 rounded-xl border border-destructive/10"
          >
            <p>Something went wrong loading the greeting.</p>
          </motion.div>
        )}

        {/* Success Content */}
        {!isLoading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            >
              <h1 className="text-6xl md:text-8xl font-bold text-primary tracking-tight leading-tight">
                {message}
              </h1>
            </motion.div>
            
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto font-light leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              A clean, minimal starting point for your next great idea.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <a 
                href="https://replit.com" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              >
                Get Started
              </a>
            </motion.div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 w-full text-center">
        <p className="text-xs text-muted-foreground/50 font-sans tracking-widest uppercase">
          Designed & Built on Replit
        </p>
      </footer>
    </div>
  );
}
