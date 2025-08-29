import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiSummaryForecastComponent } from './ai-summary-forecast.component';

describe('AiSummaryForecastComponent', () => {
  let component: AiSummaryForecastComponent;
  let fixture: ComponentFixture<AiSummaryForecastComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiSummaryForecastComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiSummaryForecastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
