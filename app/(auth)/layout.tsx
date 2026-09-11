import { Toaster } from "sonner";
export default function Layout({children}:{children:React.ReactNode}) { return <main><Toaster closeButton richColors theme="light"/>{children}</main>; }
