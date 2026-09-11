import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export const getPagesCount = async (arrayBuffer: ArrayBuffer) => {
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  return pdf.numPages;
};
