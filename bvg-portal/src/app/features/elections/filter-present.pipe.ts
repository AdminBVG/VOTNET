import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'filterPresent', standalone: true })
export class FilterPresentPipe implements PipeTransform {
  transform(value: any[]): any[] {
    if (!Array.isArray(value)) return value as any;
    return value.filter(v => (v.attendance ?? v.Attendance) && (v.attendance ?? v.Attendance) !== 'None');
  }
}


