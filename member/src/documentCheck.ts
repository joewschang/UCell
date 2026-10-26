export const requiredDocuments=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as const;
export type RequiredDocument=typeof requiredDocuments[number];
export const documentNames:Record<RequiredDocument,string>={IDENTITY_FRONT:'身分證明文件正面',IDENTITY_BACK:'身分證明文件反面',BANKBOOK_COVER:'銀行存摺封面'};
