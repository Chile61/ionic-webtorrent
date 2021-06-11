import { Component, OnInit } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { SeedNetCategories } from 'src/app/library/Config';

interface FilterItem {
  searchTag: string;
  tag: string;
  filename: string;
  filesize: string;
  description: string;
  wallet: object; // {balance, address}
}

@Component({
  selector: 'app-seed-bot',
  templateUrl: './seed-bot.page.html',
  styleUrls: ['./seed-bot.page.scss'],
})
export class SeedBotPage implements OnInit {
  searchKey = '';
  status = [];
  categories = SeedNetCategories;

  filterList: Array<FilterItem> = [];

  constructor(
    private router: Router) {
    SeedNetCategories.forEach((item, index) => this.status[index] = true);
  }

  ngOnInit() {
  }

  onSearch() { }

  onSelect(index) {
    this.status[index] = !this.status[index];
  }

  onSelectItem(item, index) {
    const extras: NavigationExtras = {
      queryParams: {
        data: JSON.stringify(item)
      }
    };
    this.router.navigate(['seed-bot-preview'], extras);
  }
}
