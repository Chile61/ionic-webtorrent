import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})
export class FilterPipe implements PipeTransform {

  transform(items: any[], searchText: string): any[] {
    alert(searchText);
    if (!items) { return []; }
    if (!searchText) { return items; }
    searchText = searchText.toLowerCase();

    return items.filter(it => {
      return it.toLowerCase().includes(searchText);
    });
  }

}
