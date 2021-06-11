import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import filesize from 'filesize';
import { SeedNetCategories } from 'src/app/library/Config';

@Component({
  selector: 'app-seed-bot-preview',
  templateUrl: './seed-bot-preview.page.html',
  styleUrls: ['./seed-bot-preview.page.scss'],
})
export class SeedBotPreviewPage implements OnInit {
  data = null;
  categories = SeedNetCategories;

  constructor(
    private route: ActivatedRoute
  ) {
    this.route.queryParams.subscribe(params => {
      this.data = JSON.parse(params.data);
    });
  }

  ngOnInit() {
  }

  onDownload() {}

  getFileSize() {
    return filesize(this.data.filesize);
  }
}
