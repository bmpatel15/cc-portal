import ModernRequestForm from '@/components/ModernRequestForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="w-full bg-[#1C2127] py-6 mb-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Content Request Portal
          </h1>
        </div>
      </div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col">
          <ModernRequestForm />
        </div>
      </div>
    </main>
  )
}