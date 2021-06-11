import { Directive, OnInit, HostListener, ElementRef } from '@angular/core';

@Directive({
  // tslint:disable-next-line:directive-selector
  selector: 'ion-textarea[autosize]'
})

export class AutosizeDirective implements OnInit {
  @HostListener('input', ['$event.target'])
  onInput(textArea: HTMLTextAreaElement): void {
    this.adjust();
  }

  constructor(public element: ElementRef) {
  }

  ngOnInit(): void {
    setTimeout(() => this.adjust(), 0);
  }

  adjust(): void {
    const textArea = this.element.nativeElement.getElementsByTagName('textarea')[0];
    if (!textArea) { return; }
    textArea.style.overflow = 'hidden';
    textArea.style.height = 'auto';
    textArea.style.height = textArea.scrollHeight + 'px';
  }
}

