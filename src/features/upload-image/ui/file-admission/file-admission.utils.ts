export function filesFromList(files: FileList, multiple: boolean): readonly File[] {
  const count = multiple ? files.length : Math.min(files.length, 1);
  const result = new Array<File>(count);
  for (let index = 0; index < count; index += 1) {
    result[index] = files[index]!;
  }
  return result;
}
