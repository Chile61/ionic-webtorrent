import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FileAccountType, FileAccountService } from 'src/app/services/file-account.service';

@Component({
  selector: 'app-file-item',
  templateUrl: './file-item.component.html',
  styleUrls: ['./file-item.component.scss'],
})
export class FileItemComponent implements OnInit, OnChanges {

  @Input()
  index: number;

  @Input()
  key: number;

  @Input()
  filterProps: Array<boolean>;

  @Input()
  visibility: boolean;

  type: FileAccountType = 0;

  constructor(
    private fileAccountService: FileAccountService
  ) { }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.key) {
      const keyValue = changes.key.currentValue;
      this.type = this.fileAccountService.getFileAccountType(keyValue);
    }
  }
}
