import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})
export const metadata = {
  title: "Load Tracking",
  description: "Track driver movement live",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google Maps API with Places library */}
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00&libraries=places`}
          async
          defer
        ></script>
      </head>
      <body className="bg-gray-100">{children}</body>
    </html>
  );
}
