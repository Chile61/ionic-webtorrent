import { Content } from '@angular/compiler/src/render3/r3_ast';
import { Component, OnInit, forwardRef, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { EmojiService } from 'src/app/services/emoji.service';

export const EMOJI_PICKER_VALUE_ACCESSOR: any = {
    provide: NG_VALUE_ACCESSOR,
    // tslint:disable-next-line:no-use-before-declare
    useExisting: forwardRef(() => EmojiPickerComponent),
    multi: true
};

@Component({
    selector: 'app-emoji-picker',
    providers: [EMOJI_PICKER_VALUE_ACCESSOR],
    templateUrl: './emoji-picker.component.html',
    styleUrls: ['./emoji-picker.component.scss'],
})
export class EmojiPickerComponent implements ControlValueAccessor, OnDestroy {
    @ViewChild('emojiGroups', { static: true }) emojiGroups: ElementRef<HTMLDivElement>;

    emojiCategories = [];
    emojiItems = [];
    emojiTitles = [];

    _content = '';
    _onChanged: any;
    _onTouched: any;

    loadingIndex = 0;
    emojiTimer = null;

    constructor(public emojiProvider: EmojiService) {
        this.emojiCategories = emojiProvider.emojiCategories;
        this.emojiTitles = emojiProvider.emojiTitles;
        this.emojiItems = emojiProvider.getEmojis();
        this.startLoadEmoji();
    }

    ngOnDestroy() {
        if (this.emojiTimer) {
            clearInterval(this.emojiTimer);
            this.emojiTimer = null;
        }
    }

    startLoadEmoji() {
        this.emojiTimer = setInterval(() => this.loadEmoji(), 300);
        this.loadEmoji();
        this.loadEmoji();
    }

    loadEmoji() {
        const emojis = this.emojiProvider.getEmojisByIndex(this.loadingIndex);
        if (emojis == null) {
            clearInterval(this.emojiTimer);
            this.emojiTimer = null;
        }
        this.emojiItems[this.loadingIndex] = emojis;
        this.loadingIndex ++;
    }

    writeValue(obj: any): void {
        this._content = obj;
    }

    registerOnChange(fn: any): void {
        this._onChanged = fn;
        this.setValue(this._content);
    }

    registerOnTouched(fn: any): void {
        this._onTouched = fn;
    }

    selectCategory(val, index) {
        const id = `group${index}`;
        const y = document.getElementById(id).offsetTop - this.emojiGroups.nativeElement.offsetTop;
        this.emojiGroups.nativeElement.scrollTo(0, y);
    }

    setValue(val: any): any {
        if (val === null) {
            return;
        }
        this._content += val;
        if (this._content) {
            this._onChanged(this._content);
        }
        this.emojiProvider.addRecent(val);
        this.emojiItems[0] = this.emojiProvider.recentItems;
    }
}
