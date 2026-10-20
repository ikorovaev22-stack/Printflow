// Shared by the upload widget (browser) and the server actions
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.svg,.psd,.ai,.eps,.cdr,.indd," +
  ".doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z";

// Must match allowed_mime_types of the order-files bucket; anything else is uploaded as octet-stream
const KNOWN_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/tiff", "image/heic",
  "image/vnd.adobe.photoshop", "application/postscript", "application/illustrator",
  "application/zip", "application/x-zip-compressed", "application/vnd.rar", "application/x-rar-compressed",
  "application/x-7z-compressed", "application/x-cdr", "application/cdr",
]);

export const uploadType = (type: string) => (KNOWN_TYPES.has(type) ? type : "application/octet-stream");

export function fileExtension(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,8}$/.test(ext) && ext !== name.toLowerCase() ? ext : "bin";
}

export const isAllowedFile = (name: string) => FILE_ACCEPT.split(",").includes(`.${fileExtension(name)}`);

// Gallery pickers in some apps name photos without an extension: take it from the type
const TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif",
  "application/pdf": "pdf",
};

export function withExtension(file: File) {
  const ext = TYPE_EXTENSIONS[file.type];
  return ext && !isAllowedFile(file.name)
    ? new File([file], `${file.name}.${ext}`, { type: file.type, lastModified: file.lastModified })
    : file;
}

// Why a file cannot be uploaded, or null
export function fileProblem(file: { name: string; size: number }) {
  if (!isAllowedFile(file.name)) return "формат не поддерживается";
  if (file.size > MAX_FILE_SIZE) return "больше 50 МБ";
  return null;
}
