export async function indexPDF(_filePath: string, _productId: string) {
  console.log('PDF indexer: stub — not implemented yet');
  return { chunks: 0 };
}

export async function indexPDFForProduct(_productId: number, _pdfBuffer: Buffer, _filename: string, _provider: string, _apiKey: string) {
  console.log('PDF indexer: stub — not implemented yet');
  return { chunks: 0 };
}

export async function generateProductEmbedding(_productId: number, _provider: string, _apiKey: string) {
  console.log('generateProductEmbedding: stub — not implemented yet');
  return { ok: true };
}
