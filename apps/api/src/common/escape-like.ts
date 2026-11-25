/** `contains` passes the text to LIKE as is, so "%" and "_" would act as wildcards (and "\" as an escape); escape them. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');
