import { NgModule } from '@angular/core';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { GridModule } from '@progress/kendo-angular-grid';
import { MatIconModule, MatTooltipModule } from '@angular/material';

import { AppComponent } from './app.component';
import { HelloComponent } from './hello.component';
import { DcEditableListComponent } from './editable-list.component';

import {
  MatIconRegistry
} from '@angular/material';

@NgModule({
  imports:      [ BrowserModule, FormsModule, GridModule, MatIconModule, MatTooltipModule, ReactiveFormsModule, BrowserAnimationsModule ],
  declarations: [ AppComponent, HelloComponent, DcEditableListComponent ],
  bootstrap:    [ AppComponent ]
})
export class AppModule {
  constructor(private _iconRegistry: MatIconRegistry, private _sanitizer: DomSanitizer) {
    _iconRegistry.addSvgIconSet(_sanitizer.bypassSecurityTrustResourceUrl('/assets/icons/mdi.svg'));
  }
 }
