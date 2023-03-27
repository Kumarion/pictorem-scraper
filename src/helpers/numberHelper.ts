function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  }
  
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let suffixIndex = 0;
  
  while (num >= 1000 && suffixIndex < suffixes.length - 1) {
    num /= 1000;
    suffixIndex++;
  }
  
  const suffix = suffixes[suffixIndex] as string;
  const formattedNumber = num.toFixed(1);
  
  return `${formattedNumber}${suffix}`;
}
  
  
export default formatNumber;