import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ResolveEnd, Event } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { CLNOpenChannelComponent } from '../open-channel-modal/open-channel.component';
import { CommonService } from '../../../../shared/services/common.service';
import { LoggerService } from '../../../../shared/services/logger.service';
import { Balance, Channel, GetInfo, Peer, UTXO } from '../../../../shared/models/clnModels';
import { SelNodeChild } from '../../../../shared/models/RTLconfig';

import { RTLState } from '../../../../store/rtl.state';
import { openAlert } from '../../../../store/rtl.actions';
import { channels, nodeInfoAndNodeSettingsAndBalance, peers, utxos } from '../../../store/cln.selector';
import { ApiCallStatusPayload } from '../../../../shared/models/apiCallsPayload';

@Component({
  selector: 'rtl-cln-channels-tables',
  templateUrl: './channels-tables.component.html',
  styleUrls: ['./channels-tables.component.scss']
})
export class CLNChannelsTablesComponent implements OnInit, OnDestroy {

  public openChannels = 0;
  public pendingChannels = 0;
  public activeHTLCs = 0;
  public selNode: SelNodeChild | null = {};
  public information: GetInfo = {};
  public peers: Peer[] = [];
  public utxos: UTXO[] = [];
  public totalBalance = 0;
  public links = [{ link: 'open', name: 'Open' }, { link: 'pending', name: 'Pending/Inactive' }, { link: 'activehtlcs', name: 'Active HTLCs' }];
  public activeLink = 0;
  private unSubs: Array<Subject<void>> = [new Subject(), new Subject(), new Subject(), new Subject(), new Subject(), new Subject()];

  constructor(private logger: LoggerService, private store: Store<RTLState>, private commonService: CommonService, private router: Router) { }

  ngOnInit() {
    this.activeLink = this.links.findIndex((link) => link.link === this.router.url.substring(this.router.url.lastIndexOf('/') + 1));
    this.router.events.pipe(takeUntil(this.unSubs[0]), filter((e) => e instanceof ResolveEnd)).
      subscribe({
        next: (value: ResolveEnd | Event) => {
          this.activeLink = this.links.findIndex((link) => link.link === (<ResolveEnd>value).urlAfterRedirects.substring((<ResolveEnd>value).urlAfterRedirects.lastIndexOf('/') + 1));
        }
      });
    this.store.select(nodeInfoAndNodeSettingsAndBalance).pipe(takeUntil(this.unSubs[1])).
      subscribe((infoSettingsBalSelector: { information: GetInfo, nodeSettings: SelNodeChild | null, balance: Balance }) => {
        this.selNode = infoSettingsBalSelector.nodeSettings;
        this.information = infoSettingsBalSelector.information;
        this.totalBalance = infoSettingsBalSelector.balance.totalBalance || 0;
        this.logger.info(infoSettingsBalSelector);
      });
    this.store.select(peers).pipe(takeUntil(this.unSubs[2])).
      subscribe((peersSelector: { peers: Peer[], apiCallStatus: ApiCallStatusPayload }) => {
        this.peers = peersSelector.peers;
      });
    this.store.select(utxos).pipe(takeUntil(this.unSubs[3])).
      subscribe((utxosSeletor: { utxos: UTXO[], apiCallStatus: ApiCallStatusPayload }) => {
        this.utxos = this.commonService.sortAscByKey(utxosSeletor.utxos?.filter((utxo) => utxo.status === 'confirmed'), 'value');
      });
    this.store.select(channels).pipe(takeUntil(this.unSubs[4])).
      subscribe((channelsSelector: { activeChannels: Channel[], pendingChannels: Channel[], inactiveChannels: Channel[], apiCallStatus: ApiCallStatusPayload }) => {
        this.openChannels = channelsSelector.activeChannels.length || 0;
        this.pendingChannels = (channelsSelector.pendingChannels.length + channelsSelector.inactiveChannels.length) || 0;
        const allChannels = [...channelsSelector.activeChannels, ...channelsSelector.pendingChannels, ...channelsSelector.inactiveChannels];
        this.activeHTLCs = allChannels?.reduce((totalHTLCs, peer) => totalHTLCs + (peer.htlcs && peer.htlcs.length > 0 ? peer.htlcs.length : 0), 0);
        this.logger.info(channelsSelector);
      });
  }

  onOpenChannel() {
    const peerToAddChannelMessage = {
      peers: this.peers,
      information: this.information,
      balance: this.totalBalance,
      utxos: this.utxos
    };
    this.store.dispatch(openAlert({
      payload: {
        data: {
          alertTitle: 'Open Channel',
          message: peerToAddChannelMessage,
          component: CLNOpenChannelComponent
        }
      }
    }));
  }

  onSelectedTabChange(event) {
    this.router.navigateByUrl('/cln/connections/channels/' + this.links[event.index].link);
  }

  ngOnDestroy() {
    this.unSubs.forEach((completeSub) => {
      completeSub.next(<any>null);
      completeSub.complete();
    });
  }

}
