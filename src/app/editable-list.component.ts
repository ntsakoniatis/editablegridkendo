import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  AsyncValidatorFn,
  ControlValueAccessor,
  FormControl,
  FormGroup,
  FormBuilder,
  NG_VALUE_ACCESSOR,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { GridComponent, PageChangeEvent, RowClassArgs, SelectionEvent } from '@progress/kendo-angular-grid';
import { orderBy, SortDescriptor } from '@progress/kendo-data-query';
import { inputData } from './data';

export interface CellClickEventArgs {
  rowIndex: number;
  columnIndex: number;
  dataItem?: any | undefined;
  [key: string]: any;
}

export interface RowEditCompletedEventArgs {
  rowData: { [key: string]: any };
  validations?: RowValidationResult[] | undefined;
}

export interface RowValidationResult extends FormValidationResult {
  [key: string]: any;
}

export interface FormValidationResult {
  controlResults: ControlValidationResult[];
}

export interface ControlValidationResult {
  control: string;
  hasErrors: boolean;
  hasWarnings: boolean;
  result: ValidationResult;
}

export interface ValidationResult {
  [type: string]: ValidationResultInfo;
}

export interface ValidationResultInfo {
  kind: string;
  message: string;
}

export interface CellEditedEventArgs {
  field: string;
  value: any;
}

export class GridColumn {
  field: string;
  header: string;
  frozen: boolean;
  editable: boolean;
  fieldType: string;
  hidden: boolean;
  sortable: boolean;
}

@Component({
  selector: 'dc-editable-list',
  templateUrl: './editable-list.component.html',
  styleUrls: ['./editable-list.component.scss'],
  providers: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DcEditableListComponent 
  implements OnInit, OnDestroy, OnChanges {

  @Output()
  public cellClicked: EventEmitter<CellClickEventArgs> = new EventEmitter<CellClickEventArgs>();

  @Output()
  public editCompleted: EventEmitter<RowEditCompletedEventArgs> = new EventEmitter<RowEditCompletedEventArgs>();

  @Output()
  public editStarted: EventEmitter<any> = new EventEmitter();

  @Output()
  public cellEdited: EventEmitter<CellEditedEventArgs> = new EventEmitter<CellEditedEventArgs>();

  @Output()
  public editCanceled: EventEmitter<any> = new EventEmitter();

  public gridSelectedData: number[];
  public gridSort: SortDescriptor[];
  public $isInEditingMode: BehaviorSubject<boolean>;
  public editFormGroup: FormGroup;
  public canUpdate: boolean;
  public data: any;
  public columns: GridColumn[];

  constructor(private _cd: ChangeDetectorRef,
              public el: ElementRef,
              private formBuilder: FormBuilder,
              private _zone: NgZone) {
    this.gridSelectedData = [];
    this.gridSort = [];
    this._inlineEditDataItem = undefined;
    this._inlineEditIsNew = false;
    this._inlineEditNewRowId = 0;
    this.canUpdate = true;
    this.data = inputData;

    this.$isInEditingMode = new BehaviorSubject(false);

    this.columns = [{
      field: 'recordId',
      header: 'Id',
      frozen: false,
      editable: true,
      fieldType: 'integer',
      hidden: false,
      sortable: true
    },
    {
      field: 'recordCode',
      header: 'Code',
      frozen: false,
      editable: true,
      fieldType: 'string',
      hidden: false,
      sortable: true
    },
    {
      field: 'recordDescription',
      header: 'Description',
      frozen: false,
      editable: true,
      fieldType: 'string',
      hidden: false,
      sortable: true
    },
    {
      field: 'recordProduct',
      header: 'Product',
      frozen: false,
      editable: true,
      fieldType: 'string',
      hidden: false,
      sortable: true
    }]
}

  @ViewChild(GridComponent, { static: false })
  private _table: GridComponent;

  private _inlineEditCurrentRowIndex: number;
  private _inlineEditDataItem: any;
  private _inlineEditIsNew: boolean;
  private _inlineEditNewRowId: number;

  public get isInEditingMode(): boolean {
    return this._inlineEditCurrentRowIndex !== undefined || this._inlineEditIsNew;
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public ngOnChanges(changes: SimpleChanges) {}

  public rowCallback(context: RowClassArgs): any {
    const isEven = context.index % 2 === 0;
    return {
      even: isEven,
      odd: !isEven,
      compact: true
    };
  }

  public dataStateChange(event: any) {
    this._cd.markForCheck();
  }

  public columnReorder(event: any) {
    this._cd.markForCheck();
  }

  public cellClickHandler({ dataItem, columnIndex, rowIndex, isEdited, sender }: any): void {
    this.cellClicked.emit({
      dataItem: dataItem,
      rowIndex: rowIndex,
      columnIndex: columnIndex,
      ['id']: dataItem['id']
    });

    if (isEdited) {
      return;
    }

    // Save current
    if (this.isInEditingMode) {
      this.inlineEditSaveRow(this._inlineEditDataItem['id']);
    }
    // Edit row clicked
    this.inlineEditBeginHandler({ dataItem, rowIndex, sender });
    // Focus clicked cell
    setTimeout(() => {
      try {
        (<HTMLElement>(
          document.querySelector(`.k-grid .k-grid-edit-row > td:nth-child(${columnIndex - 1}) input`)
        )).focus();
      } catch (error) {}
    }, 2000);
  }

  private inlineEditSaveRow(id: any): void {
    if (this.isInEditingMode) {
      const args: RowEditCompletedEventArgs = {
          rowData: null,
          validations: null
      };
      this.editCompleted.emit(args);
    }

    this.inlineEditCloseEditor(this._table);
  }

  private inlineEditCloseEditor(grid: GridComponent, rowIndex: number = this._inlineEditCurrentRowIndex): void {
    this._inlineEditIsNew = false;
    this._inlineEditCurrentRowIndex = undefined;
    this._inlineEditDataItem = undefined;
    this.editFormGroup = undefined;
    this.$isInEditingMode.next(this._inlineEditCurrentRowIndex !== undefined || this._inlineEditIsNew);
    grid.closeRow(rowIndex);

    this._zone.runOutsideAngular(() => {
      (this.el.nativeElement as HTMLElement).removeEventListener('keypress', this.enterKeyHandler);
    });
  }

  public enterKeyHandler(e) {
    const key = e.key;
    if (key === 'Enter' && this.isInEditingMode && this._table.activeRow && this._table.activeRow.dataItem) {
      this._zone.run(() => {
        this.inlineEditSaveRow(this._table.activeRow.dataItem['id']);
      });
    }
  }

  public inlineEditBeginHandler({ dataItem, rowIndex, sender }: any): void {
    this.editStarted.emit();
    if (rowIndex === -1) {
      return;
    }

    this.inlineEditHandler({
      dataItem: dataItem,
      rowIndex: rowIndex,
      sender: sender,
      isNew: this._inlineEditIsNew
    });
  }

  public inlineEditHandler({ dataItem, rowIndex, sender, isNew }: any): void {
    this.editFormGroup = this.inlineEditCreateFormGroup(dataItem);
    this._inlineEditCurrentRowIndex = rowIndex;
    this.$isInEditingMode.next(this._inlineEditCurrentRowIndex !== undefined || this._inlineEditIsNew);
    this._inlineEditDataItem = dataItem;
    this._table.editRow(rowIndex, this.editFormGroup);

    this._zone.runOutsideAngular(() => {
      (this.el.nativeElement as HTMLElement).addEventListener('keypress', this.enterKeyHandler.bind(this));
    });
  }

  public inlineEditCreateFormGroup(dataItem: any): FormGroup {
        return new FormGroup({
            'recordId': new FormControl(dataItem.recordId),
            'recordCode': new FormControl(dataItem.recordCode, Validators.required),
            'recordDescription': new FormControl(dataItem.recordDescription, Validators.required),
            'recordProduct': new FormControl(dataItem.recordProduct)
    });
  }

  public inlineEditCancelHandler(): void {
    this.inlineEditCloseEditor(this._table);
    this.editCanceled.emit();
  }

  public inlineEditSaveHandler({ dataItem, rowIndex, sender }: any): void {
    if (this.isInEditingMode) {
      this.inlineEditSaveRow(dataItem['id']);
      this._cd.markForCheck();
    }
  }

  public columnEditor(fieldType: string): string {
    let result: string;
    switch (fieldType) {
      case 'boolean': {
        result = 'boolean';
        break;
      }
      case 'date': {
        result = 'date';
        break;
      }
      case 'integer':
      case 'decimal': {
        result = 'numeric';
        break;
      }
      default: {
        result = 'text';
        break;
      }
    }

    return result;
  }

  public trackColsByFn(index: number, item: any) {
    return item.field;
  }
}