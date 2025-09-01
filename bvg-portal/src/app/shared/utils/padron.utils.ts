export interface PadronRow { 
  id: string; 
  shareholderId: string; 
  shareholderName: string; 
  shares: number;
  attendance: string;
  legalRepresentative?: string;
  proxy?: string;
}

/**
 * Ordena el padrón por ID numéricamente
 */
export function sortPadronByNumericId(padron: PadronRow[]): PadronRow[] {
  return padron.sort((a, b) => {
    const aNum = parseInt(a.shareholderId) || 0;
    const bNum = parseInt(b.shareholderId) || 0;
    return aNum - bNum;
  });
}

/**
 * Valida si un accionista puede ser eliminado
 */
export function canDeleteShareholder(shareholder: PadronRow): boolean {
  return shareholder.attendance === 'None';
}

/**
 * Obtiene el mensaje de error para eliminación
 */
export function getDeleteErrorMessage(shareholder: PadronRow): string {
  if (shareholder.attendance !== 'None') {
    return 'No se puede eliminar: ya tiene asistencia registrada';
  }
  return '';
}
