import { Component, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { OwnAuthService } from './services/auth/auth.service';
import { Router, ActivatedRoute, Routes } from '@angular/router';
import { DataService } from './data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent { 
  title = 'TrustPool App';
  clicked:boolean = true;
  jumbo:boolean = false;
  headerHide:boolean = false;
  loggedIn:boolean;
  user: any
  constructor(private auth: OwnAuthService, private router: Router, private dataService: DataService) {
  }
  ngOnInit() {
    this.auth.checkLogin().subscribe(({ user }: any) => {
      if (user) {
        this.user = user;
        this.loggedIn = true;
        this.clicked = false;
        this.headerHide = true;
        this.dataService.userLogin();
        this.router.navigate(['home']);
      }
      this.router.navigate(['home']);
    });
  }
  isClicked() {
    this.clicked = false;
  }
  showHeader() {
    this.headerHide = true;
  }

  showJumboTronText() {
    if(!this.jumbo) {
      this.jumbo = true;
    } else {
      this.jumbo = false;
    }
  }
}
