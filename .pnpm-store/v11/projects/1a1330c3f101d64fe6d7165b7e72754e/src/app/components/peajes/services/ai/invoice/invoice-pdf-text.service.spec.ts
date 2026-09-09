import { InvoicePdfTextService } from './invoice-pdf-text.service';

function pdfFile(name: string): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function parserStub(pages: string[]): {
  getInfo: () => Promise<{ total: number }>;
  getText: (params?: { partial?: number[] }) => Promise<{ text: string }>;
  destroy: () => Promise<void>;
} {
  return {
    getInfo: async () => ({ total: pages.length }),
    getText: async (params) => {
      const page = params?.partial?.[0] ?? 1;
      return { text: pages[page - 1] ?? '' };
    },
    destroy: async () => undefined,
  };
}

describe('InvoicePdfTextService', () => {
  let service: InvoicePdfTextService;
  let destroyed: boolean;

  beforeEach(() => {
    destroyed = false;
    service = new InvoicePdfTextService();
  });

  it('joins every PDF page and rejects empty extracted text', async () => {
    const twoPages = parserStub(['page 1', 'page 2']);
    const empty = parserStub(['', '   ']);
    empty.destroy = async () => {
      destroyed = true;
    };
    twoPages.destroy = async () => {
      destroyed = true;
    };

    spyOn(InvoicePdfTextService, 'createParser').and.returnValues(twoPages as never, empty as never);
    spyOn(InvoicePdfTextService, 'configureWorker');

    await expectAsync(service.extractText(pdfFile('two.pdf'))).toBeResolvedTo('page 1\npage 2');
    await expectAsync(service.extractText(pdfFile('empty.pdf'))).toBeRejectedWithError(
      /texto seleccionable/i
    );
    expect(destroyed).toBeTrue();
  });

  it('skips blank pages and still destroys the parser', async () => {
    const mixed = parserStub(['', 'keep me', '  ']);
    mixed.destroy = async () => {
      destroyed = true;
    };
    spyOn(InvoicePdfTextService, 'createParser').and.returnValue(mixed as never);
    spyOn(InvoicePdfTextService, 'configureWorker');

    await expectAsync(service.extractText(pdfFile('mixed.pdf'))).toBeResolvedTo('keep me');
    expect(destroyed).toBeTrue();
  });
});
