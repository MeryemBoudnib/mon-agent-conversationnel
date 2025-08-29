import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocList {
  ok: boolean;
  scopes: string[];
  count: number;
  docs: { name: string; pages: number; scope: string }[];
}

@Injectable({ providedIn: 'root' })
export class DocqaService {
  private readonly API = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  listDocs(ns: string, conv?: number | null): Observable<DocList> {
    let params = new HttpParams().set('ns', ns);
    if (conv != null) params = params.set('conv', String(conv));
    return this.http.get<DocList>(`${this.API}/docs`, { params });
  }

  ingestFile(file: File, ns: string, conv?: number | null): Observable<any> {
    const fd = new FormData();
    fd.append('ns', ns);
    if (conv != null) fd.append('conv', String(conv));
    fd.append('file', file, file.name);
    return this.http.post(`${this.API}/ingest`, fd);
  }
}
