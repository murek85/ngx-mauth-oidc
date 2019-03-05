import { NgModule, ModuleWithProviders } from '@angular/core';
import { NgxMAuthOidcService } from './oidc.service';
import { NgxMAuthOidcHelperService } from './oidc-helper.service';
import { NgxMAuthOidcConfigModule } from './oidc-config.module';
import { createDefaultStorage } from './oidc-factories';
import { NgxMAuthOidcStorage } from './oidc-models';

@NgModule({
    imports: [],
    declarations: [],
    exports: []
})
export class NgxMAuthOidcModule {
    static forRoot(
        config: NgxMAuthOidcConfigModule = null
    ): ModuleWithProviders {
        return {
            ngModule: NgxMAuthOidcModule,
            providers: [
                NgxMAuthOidcService,
                NgxMAuthOidcHelperService,

                { provide: NgxMAuthOidcStorage, useFactory: createDefaultStorage },
                { provide: NgxMAuthOidcConfigModule, useValue: config }
            ]
        };
    }
}
