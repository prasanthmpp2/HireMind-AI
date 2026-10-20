import domtoimage from "dom-to-image";
import jsPDF from "jspdf";

export const exportResumePdf = async (element: HTMLElement, filename: string) => {
  const scale = 2;
  const width = Math.ceil(element.scrollWidth);
  const height = Math.ceil(element.scrollHeight);

  const dataUrl = await domtoimage.toPng(element, {
    bgcolor: "#ffffff",
    cacheBust: true,
    height: height * scale,
    width: width * scale,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      width: `${width}px`,
      height: `${height}px`
    }
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageMargin = 8;
  const pageWidth = pdf.internal.pageSize.getWidth() - pageMargin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - pageMargin * 2;

  const img = new Image();
  img.src = dataUrl;

  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const imgWidthMm = pageWidth;
  const imgHeightMm = (img.height * imgWidthMm) / img.width;
  let positionMm = pageMargin;
  let remainingHeightMm = imgHeightMm;

  while (remainingHeightMm > 0) {
    pdf.addImage(dataUrl, "PNG", pageMargin, positionMm, imgWidthMm, imgHeightMm, undefined, "FAST");
    remainingHeightMm -= pageHeight;
    if (remainingHeightMm > 0) {
      pdf.addPage();
      positionMm -= pageHeight;
    }
  }

  pdf.save(filename);
};
