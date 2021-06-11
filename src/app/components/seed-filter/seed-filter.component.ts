import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { SeedFilters, SEEDNET_DIR, SEEDWEB_DIR } from 'src/app/library/Config';
import { WebtorrentService } from 'src/app/services/webtorrent/webtorrent.service';

@Component({
  selector: 'app-seed-filter',
  templateUrl: './seed-filter.component.html',
  styleUrls: ['./seed-filter.component.scss'],
})
export class SeedFilterComponent implements OnInit {

  @Output() changeFilter: EventEmitter<any> = new EventEmitter();

  status = [];
  filters = SeedFilters;

  get hasVideos() {
    const iterKeys = this.webTorrentService.torrentItemList.keys();
    const keys: Array<number> = Array.from(iterKeys);
    return keys.length !== 0;
  }

  constructor(
    public webTorrentService: WebtorrentService
  ) {
    SeedFilters.forEach((item, index) => this.status[index] = false);
  }

  ngOnInit() { }

  onSelect(index) {
    this.status[index] = !this.status[index];
    this.changeFilter.emit(this.status);
  }

  isReady(item) {
    const { title } = item;
    if (title === SEEDWEB_DIR || title === SEEDNET_DIR) {
      return true;
    }
    if (title === 'Movies') {
      return this.hasVideos;
    }
    return item.isReady;
  }
}
