/**
 * this file is part of bundesblock-voting
 *
 * it is subject to the terms and conditions defined in
 * the 'LICENSE' file, which is part of the repository.
 *
 * @author Heiko Burkhardt
 * @copyright 2018 by Slock.it GmbH
 */

import * as React from 'react';
import * as Sol from '../solidity-handler/SolidityHandler';
import * as queryString from 'query-string';
import { Sidebar } from './Sidebar';
import { View, TabEntity, TabEntityType } from './View';
import * as $ from 'jquery';
import Web3Type from '../types/web3';
import SplitPane from 'react-split-pane';
import { getContracts } from '../utils/GitHub';
import { withRouter } from 'react-router-dom';
import * as Web3 from 'web3';

interface AppContainerState {
    contracts: Sol.Contract[];
    contractToSelect: string;
    contractToSelectAddress: string;
    selectedElement: Sol.NodeElement;
    web3: Web3Type;
    isLaoding: boolean;
    tabEntities: TabEntity[][];
    activeTab: number[];
}

class AppContainer extends React.Component<{}, {}> {
    state: AppContainerState;

    constructor(props: any) {
        super(props);

        this.state = {
            contracts: [],
            selectedElement: null,
            contractToSelect: null,
            contractToSelectAddress: null,
            web3: null, // new Web3(web3),
            
            isLaoding: false,
            
            tabEntities: [[], []],
            activeTab: [null, null]

        };
        
        this.updateContractNames = this.updateContractNames.bind(this);
        this.changeSelectedElement = this.changeSelectedElement.bind(this);
        this.setIsLoading = this.setIsLoading.bind(this);
        this.addTabEntity = this.addTabEntity.bind(this);
        this.changeActiveTab = this.changeActiveTab.bind(this);
        this.markCode = this.markCode.bind(this);
        this.changeContractAddress = this.changeContractAddress.bind(this);
        this.getEvents = this.getEvents.bind(this);
        this.contentChange = this.contentChange.bind(this);
        this.removeTabEntity = this.removeTabEntity.bind(this);
        this.gotContractsFromGithub = this.gotContractsFromGithub.bind(this);
        this.removeContractToSelect = this.removeContractToSelect.bind(this);

    }

    removeContractToSelect(): void {
        this.setState({
            contractToSelect: null
        });
    }

    contentChange(viewId: number, tabId: number, content: any): void {
        this.setState((prevState: AppContainerState) => {
            prevState.tabEntities[viewId][tabId].content = content;
            return {
                tabEntities: prevState.tabEntities
            };
        });
    }
    
    changeContractAddress(newContractAddress: string, contractName: string): void {
      
        this.setState((prevState: AppContainerState) => {
            const contractIndex: number = prevState.contracts.findIndex((c: Sol.Contract) => c.name === contractName);
            if (contractIndex !== -1) {
                prevState.contracts[contractIndex].deployedAt = newContractAddress;
            }

            return {
                contracts: prevState.contracts
            };

        });
        
    }

    changeActiveTab(viewId: number, tabId: number): void {
        this.setState((prevState: AppContainerState) => {
            prevState.activeTab[viewId] = tabId;

            return {
                activeTab: prevState.activeTab
            };

        });
    }

    setIsLoading(isLoading: boolean): void {
        this.setState({isLaoding: isLoading});
    }

    async componentDidMount(): Promise<void> {

        this.initViews();

        let web3: any = null;

        if ((window as any).ethereum) {
            web3 = new Web3((window as any).ethereum);
            try {
                // Request account access if needed
                await (window as any).ethereum.enable();
            } catch (error) {
                // User denied account access...
            }
        }
        // Legacy dapp browsers...
        else if ((window as any).web3) {
            web3 = new Web3(web3.currentProvider);
        }
        // Non-dapp browsers...
        else {
            console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
        }

        const params: any = queryString.parse((this.props as any).location.search);
        
        this.setState({
            web3: web3,
            contractToSelect: params.contract ? params.contract : null,
            contractToSelectAddress: params.contractAddress ? params.contractAddress : null
        });

        if (params.gitHubRepo) {
            
            this.setIsLoading(true);
            await getContracts(
                'https://api.github.com/repos/' + (params.gitHubRepo as string),
                this.gotContractsFromGithub, params.subDir as string);
            // await getContracts('https://api.github.com/repos/slockit/usn-mvp', this.gotContractsFromGithub, 'contracts')
        }

        setTimeout(() => { 

            $('.animation-container').css('display', 'none');
            $('.non-animation-container').css('display', 'block');

        },         1);

    }

    gotContractsFromGithub(files: any): void {
        const contracts: Sol.Contract[] = Sol.parseContent(files);
        const params: any = queryString.parse((this.props as any).location.search);
        const contractName: string = params.contract ? params.contract.toString() : null;
        const selectedContract: Sol.Contract = contracts.find((contract: Sol.Contract) => contract.name === contractName);
        if (selectedContract) {
            selectedContract.deployedAt = params.contractAddress ? params.contractAddress as string : selectedContract.deployedAt;
        }

        this.setState({
            contractToSelect: selectedContract ? selectedContract.name : null,
            contracts: contracts
        });
        this.removeTabEntity('About');
        this.setIsLoading(false);
    }

    async updateContractNames(selectorFiles: FileList): Promise<void> {
        this.setState({selectedElement: null});
        this.setIsLoading(true);

        this.setState({
            contracts: await Sol.pushFiles(selectorFiles)
        });
        this.setIsLoading(false);
        this.removeTabEntity('About');
        
    }

    removeTabEntity(tabName: string): void {
        
        let tabIndex: number = -1;

        const viewIndex: number = this.state.tabEntities.findIndex((tabEntities: TabEntity[]) => {
            tabIndex = tabEntities.findIndex((tabEntity: TabEntity) =>     
                tabEntity.name === tabName
            );
            return tabIndex !== -1;
        });

        if (tabIndex !== -1) {
            
            this.changeActiveTab(viewIndex, 0);
            this.setState((prevState: AppContainerState) => {
                
                prevState.tabEntities[viewIndex].splice(tabIndex, 1);

                return {
                    activeTab: prevState.activeTab,
                    tabEntities: prevState.tabEntities
                };
            });
        }
    }

    addTabEntity(tabEntity: TabEntity, viewId: number, replace: boolean): void {
        const index: number = this.state.tabEntities[viewId].findIndex((item: TabEntity) => item.name === tabEntity.name);

        if (index === -1) {
            this.setState((prevState: AppContainerState) => {
                const newIndex: number = prevState.tabEntities[viewId].push(tabEntity) - 1;
                if (tabEntity.active) {
                    prevState.activeTab[viewId] = newIndex;
                }

                return {
                    tabEntities: prevState.tabEntities,
                    activeTab: prevState.activeTab
                };
            });
        } else {
            this.setState((prevState: AppContainerState) => {
    
                prevState.activeTab[viewId] = index;

                if (replace) {            
                    prevState.tabEntities[viewId][index] = tabEntity;
                    return {
                        tabEntities: prevState.tabEntities,
                        activeTab: prevState.activeTab
                    };
                }

                return {
   
                    activeTab: prevState.activeTab
                };
            });
        }

    }

    getEvents(contract: Sol.Contract, event: Sol.ContractEvent, params: Sol.ContractFunctionParam[]): void {

        this.addTabEntity({
            active: true,
            contentType: TabEntityType.EventCatcher,
            name: event.name,
            content: {
                contract: contract,
                event: event,
                params: params
            },
            icon: 'bell',
            removable: true
           
        },                1, true);
    }

    markCode(start: number, end: number, contract: Sol.Contract): void {
        this.addTabEntity({
            active: true,
            contentType: TabEntityType.Code,
            name: contract.name,
            content: { 
                source: contract.source,
                marker: null
            },
            icon: 'code',
            removable: true
           
        },                1, false);

        const startLine: number = contract.source.substring(0, start).split('\n').length - 1;
        const endLine: number = startLine + contract.source.substring(start, end).split('\n').length;

        this.setState((prevState: AppContainerState) => {
            const tabEntityIndex: number = prevState.tabEntities[1].findIndex((tabEntity: TabEntity) => tabEntity.name === contract.name);
            prevState.tabEntities[1][tabEntityIndex].content.markers = [{
                startRow: startLine,
                startCol: 0,
                endRow: endLine,
                endCol: 0,
                className: 'ace_highlight-marker',
                type: 'background'
            }];
            return {
                tabEntities: prevState.tabEntities
            };

        });  

    }

    initViews(): void {

            const structureTab: TabEntity = {
                active: false,
                contentType: TabEntityType.Structure,
                name: 'Inspector',
                content: null,
                icon: 'stethoscope',
                removable: false
            };

            const fileTab: TabEntity = {
                active: true,
                contentType: TabEntityType.FileBrowser,
                name: 'Files',
                content: this.state.contracts,
                icon: 'copy',
                removable: false
            };

            const graphTab: TabEntity = {
                active: false,
                contentType: TabEntityType.Graph,
                name: 'Graph',
                content: null,
                icon: 'map',
                removable: false
            };

            const aboutTab: TabEntity = {
                active: true,
                contentType: TabEntityType.About,
                name: 'About',
                content: null,
                icon: 'question-circle',
                removable: true
            };

            this.setState((prevState: AppContainerState) => {
                prevState.tabEntities[0].push(fileTab);
                prevState.tabEntities[0].push(structureTab);
                prevState.tabEntities[1].push(aboutTab);
                prevState.tabEntities[1].push(graphTab);
                
                return {
                    tabEntities: prevState.tabEntities,
                    activeTab: [0, 0]
                };
            });

    }

    changeSelectedElement(selectedElement: Sol.NodeElement): void {
        this.changeActiveTab(0, 1);

        this.setState({
            selectedElement: selectedElement
        });
    }

    render(): JSX.Element {

        return  <div>
                    <SplitPane split='vertical' minSize={300} defaultSize={500} >
                    
                        <SplitPane split='vertical'  defaultSize={60} allowResize={false} >
                                
                                <Sidebar 
                                    addTabEntity={this.addTabEntity}
                                    isLoading={this.state.isLaoding} 
                                    submitFiles={this.updateContractNames} 
                                    changeActiveTab={this.changeActiveTab}
                                />
                                <View 
                                    removeContractToSelect={this.removeContractToSelect}
                                    selectedContractName={this.state.contractToSelect}
                                    removeTabEntity={this.removeTabEntity}
                                    loading={this.state.isLaoding}
                                    viewId={0}
                                    markCode={this.markCode}  
                                    activeTab={this.state.activeTab}
                                    tabEntities={this.state.tabEntities[0]}
                                    addTabEntity={this.addTabEntity}
                                    selectedElement={this.state.selectedElement}
                                    web3={this.state.web3} 
                                    changeContractAddress={this.changeContractAddress}
                                    changeSelectedElement={this.changeSelectedElement}
                                    contracts={this.state.contracts}
                                    changeActiveTab={this.changeActiveTab}
                                    getEvents={this.getEvents}
                                    contentChange={this.contentChange}
                                    submitFiles={this.updateContractNames}
                                />
                                    
                        </SplitPane>
                    
                            <View
                                removeContractToSelect={this.removeContractToSelect}
                                selectedContractName={this.state.contractToSelect}
                                removeTabEntity={this.removeTabEntity}
                                loading={this.state.isLaoding}
                                markCode={this.markCode}   
                                viewId={1}
                                activeTab={this.state.activeTab}
                                tabEntities={this.state.tabEntities[1]}
                                addTabEntity={this.addTabEntity}
                                selectedElement={this.state.selectedElement}
                                web3={this.state.web3} 
                                changeContractAddress={this.changeContractAddress}
                                changeSelectedElement={this.changeSelectedElement}
                                contracts={this.state.contracts}
                                changeActiveTab={this.changeActiveTab}
                                getEvents={this.getEvents}
                                contentChange={this.contentChange}
                                submitFiles={this.updateContractNames}
                            />
                
                    </SplitPane> 
                       
                </div>;

    }

}

export const App: any = withRouter(AppContainer);