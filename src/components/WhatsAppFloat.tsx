import { useWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";

export function WhatsAppFloat() {
  const number = useWhatsAppNumber();
  return (
    <a
      href={whatsappLink("Olá Pamela! Vim pelo catálogo da Banca 🌸", number)}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg shadow-black/20 transition hover:scale-110 active:scale-95"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current">
        <path d="M19.11 17.27c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.67-2.09-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.11 3.22 5.12 4.51.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM16.02 6.4c-5.3 0-9.6 4.3-9.6 9.6 0 1.7.44 3.34 1.28 4.79L6 25.6l4.95-1.3a9.55 9.55 0 0 0 5.07 1.45c5.3 0 9.6-4.3 9.6-9.6s-4.3-9.6-9.6-9.6z" />
      </svg>
    </a>
  );
}